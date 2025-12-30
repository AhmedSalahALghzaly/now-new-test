"""
Al-Ghazaly Auto Parts API - Modern Offline-First Architecture
Backend: FastAPI + MongoDB + Redis caching + WebSockets
"""
from fastapi import FastAPI, APIRouter, HTTPException, Response, Request, Query, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Set
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import json
import time

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create the main app
app = FastAPI(title="Al-Ghazaly Auto Parts API", version="2.0.0")
api_router = APIRouter(prefix="/api")

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# MongoDB
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'alghazaly_db')
client: AsyncIOMotorClient = None
db = None

# WebSocket Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.anonymous_connections: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket, user_id: str = None):
        await websocket.accept()
        if user_id:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = set()
            self.active_connections[user_id].add(websocket)
        else:
            self.anonymous_connections.add(websocket)
    
    def disconnect(self, websocket: WebSocket, user_id: str = None):
        if user_id and user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
        else:
            self.anonymous_connections.discard(websocket)
    
    async def broadcast(self, message: dict):
        for connections in self.active_connections.values():
            for conn in connections:
                try:
                    await conn.send_json(message)
                except:
                    pass
        for conn in self.anonymous_connections:
            try:
                await conn.send_json(message)
            except:
                pass

manager = ConnectionManager()

# Pydantic Schemas
class CarBrandCreate(BaseModel):
    name: str
    name_ar: str
    logo: Optional[str] = None

class CarModelCreate(BaseModel):
    brand_id: str
    name: str
    name_ar: str
    year_start: Optional[int] = None
    year_end: Optional[int] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    description_ar: Optional[str] = None
    variants: List[dict] = []

class ProductBrandCreate(BaseModel):
    name: str
    name_ar: Optional[str] = None
    logo: Optional[str] = None
    country_of_origin: Optional[str] = None
    country_of_origin_ar: Optional[str] = None

class CategoryCreate(BaseModel):
    name: str
    name_ar: str
    parent_id: Optional[str] = None
    icon: Optional[str] = None

class ProductCreate(BaseModel):
    name: str
    name_ar: str
    description: Optional[str] = None
    description_ar: Optional[str] = None
    price: float
    sku: str
    product_brand_id: Optional[str] = None
    category_id: Optional[str] = None
    image_url: Optional[str] = None
    images: List[str] = []
    car_model_ids: List[str] = []
    stock_quantity: int = 0
    hidden_status: bool = False

class CartItemAdd(BaseModel):
    product_id: str
    quantity: int = 1

class OrderCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str
    street_address: str
    city: str
    state: str
    country: str = "Egypt"
    delivery_instructions: Optional[str] = None
    payment_method: str = "cash_on_delivery"
    notes: Optional[str] = None

class CommentCreate(BaseModel):
    text: str
    rating: Optional[int] = None

class FavoriteAdd(BaseModel):
    product_id: str

# Sync Request Schemas
class SyncPullRequest(BaseModel):
    last_pulled_at: Optional[int] = None
    tables: List[str] = []

# Helpers
def get_timestamp_ms() -> int:
    return int(time.time() * 1000)

def serialize_doc(doc):
    if doc is None:
        return None
    doc = dict(doc)
    if '_id' in doc:
        doc['id'] = str(doc['_id'])
        del doc['_id']
    return doc

# Auth Helpers
async def get_session_token(request: Request) -> Optional[str]:
    token = request.cookies.get("session_token")
    if token:
        return token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None

async def get_current_user(request: Request):
    token = await get_session_token(request)
    if not token:
        return None
    session = await db.sessions.find_one({"session_token": token})
    if not session:
        return None
    if session.get("expires_at") and session["expires_at"] <= datetime.now(timezone.utc):
        return None
    user = await db.users.find_one({"_id": session["user_id"]})
    return serialize_doc(user) if user else None

# ==================== Auth Routes ====================

@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    async with httpx.AsyncClient() as client_http:
        try:
            auth_response = await client_http.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session_id")
            user_data = auth_response.json()
        except Exception as e:
            logger.error(f"Auth API error: {e}")
            raise HTTPException(status_code=500, detail="Authentication service error")
    
    user = await db.users.find_one({"email": user_data["email"]})
    if not user:
        user = {
            "_id": str(uuid.uuid4()),
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture"),
            "is_admin": False,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(user)
    
    session = {
        "_id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "session_token": user_data["session_token"],
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    }
    await db.sessions.insert_one(session)
    
    response.set_cookie(key="session_token", value=session["session_token"], httponly=True, secure=True, samesite="none", path="/", max_age=7*24*60*60)
    return {"user": serialize_doc(user), "session_token": session["session_token"]}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = await get_session_token(request)
    if token:
        await db.sessions.delete_one({"session_token": token})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ==================== Car Brands ====================

@api_router.get("/car-brands")
async def get_car_brands():
    brands = await db.car_brands.find({"deleted_at": None}).sort("name", 1).to_list(1000)
    return [serialize_doc(b) for b in brands]

@api_router.post("/car-brands")
async def create_car_brand(brand: CarBrandCreate):
    doc = {"_id": f"cb_{uuid.uuid4().hex[:8]}", **brand.dict(), "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None}
    await db.car_brands.insert_one(doc)
    await manager.broadcast({"type": "sync", "tables": ["car_brands"]})
    return serialize_doc(doc)

@api_router.delete("/car-brands/{brand_id}")
async def delete_car_brand(brand_id: str):
    await db.car_brands.update_one({"_id": brand_id}, {"$set": {"deleted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["car_brands"]})
    return {"message": "Deleted"}

# ==================== Car Models ====================

@api_router.get("/car-models")
async def get_car_models(brand_id: Optional[str] = None):
    query = {"deleted_at": None}
    if brand_id:
        query["brand_id"] = brand_id
    models = await db.car_models.find(query).sort("name", 1).to_list(1000)
    return [serialize_doc(m) for m in models]

@api_router.get("/car-models/{model_id}")
async def get_car_model(model_id: str):
    model = await db.car_models.find_one({"_id": model_id})
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    model_data = serialize_doc(model)
    brand = await db.car_brands.find_one({"_id": model["brand_id"]})
    model_data["brand"] = serialize_doc(brand)
    products = await db.products.find({"car_model_ids": model_id, "deleted_at": None}).to_list(100)
    model_data["compatible_products"] = [serialize_doc(p) for p in products]
    model_data["compatible_products_count"] = len(products)
    return model_data

@api_router.post("/car-models")
async def create_car_model(model: CarModelCreate):
    doc = {"_id": f"cm_{uuid.uuid4().hex[:8]}", **model.dict(), "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None}
    await db.car_models.insert_one(doc)
    await manager.broadcast({"type": "sync", "tables": ["car_models"]})
    return serialize_doc(doc)

@api_router.put("/car-models/{model_id}")
async def update_car_model(model_id: str, model: CarModelCreate):
    await db.car_models.update_one({"_id": model_id}, {"$set": {**model.dict(), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["car_models"]})
    return {"message": "Updated"}

@api_router.delete("/car-models/{model_id}")
async def delete_car_model(model_id: str):
    await db.car_models.update_one({"_id": model_id}, {"$set": {"deleted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["car_models"]})
    return {"message": "Deleted"}

# ==================== Product Brands ====================

@api_router.get("/product-brands")
async def get_product_brands():
    brands = await db.product_brands.find({"deleted_at": None}).sort("name", 1).to_list(1000)
    return [serialize_doc(b) for b in brands]

@api_router.post("/product-brands")
async def create_product_brand(brand: ProductBrandCreate):
    doc = {"_id": f"pb_{uuid.uuid4().hex[:8]}", **brand.dict(), "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None}
    await db.product_brands.insert_one(doc)
    await manager.broadcast({"type": "sync", "tables": ["product_brands"]})
    return serialize_doc(doc)

@api_router.delete("/product-brands/{brand_id}")
async def delete_product_brand(brand_id: str):
    await db.product_brands.update_one({"_id": brand_id}, {"$set": {"deleted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["product_brands"]})
    return {"message": "Deleted"}

# ==================== Categories ====================

@api_router.get("/categories")
async def get_categories(parent_id: Optional[str] = None):
    query = {"deleted_at": None}
    if parent_id is None:
        query["parent_id"] = None
    else:
        query["parent_id"] = parent_id
    categories = await db.categories.find(query).sort([("sort_order", 1), ("name", 1)]).to_list(1000)
    return [serialize_doc(c) for c in categories]

@api_router.get("/categories/all")
async def get_all_categories():
    categories = await db.categories.find({"deleted_at": None}).sort([("sort_order", 1), ("name", 1)]).to_list(1000)
    return [serialize_doc(c) for c in categories]

@api_router.get("/categories/tree")
async def get_categories_tree():
    categories = await db.categories.find({"deleted_at": None}).sort([("sort_order", 1), ("name", 1)]).to_list(1000)
    all_cats = [serialize_doc(c) for c in categories]
    cats_by_id = {c["id"]: {**c, "children": []} for c in all_cats}
    root = []
    for c in all_cats:
        if c.get("parent_id") and c["parent_id"] in cats_by_id:
            cats_by_id[c["parent_id"]]["children"].append(cats_by_id[c["id"]])
        elif not c.get("parent_id"):
            root.append(cats_by_id[c["id"]])
    return root

@api_router.post("/categories")
async def create_category(category: CategoryCreate):
    doc = {"_id": f"cat_{uuid.uuid4().hex[:8]}", **category.dict(), "sort_order": 0, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None}
    await db.categories.insert_one(doc)
    await manager.broadcast({"type": "sync", "tables": ["categories"]})
    return serialize_doc(doc)

@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str):
    await db.categories.update_one({"_id": cat_id}, {"$set": {"deleted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["categories"]})
    return {"message": "Deleted"}

# ==================== Products ====================

@api_router.get("/products")
async def get_products(category_id: Optional[str] = None, product_brand_id: Optional[str] = None, car_model_id: Optional[str] = None, car_brand_id: Optional[str] = None, min_price: Optional[float] = None, max_price: Optional[float] = None, skip: int = 0, limit: int = 50, include_hidden: bool = False):
    query = {"deleted_at": None}
    if not include_hidden:
        query["$or"] = [{"hidden_status": False}, {"hidden_status": None}]
    if category_id:
        subcats = await db.categories.find({"parent_id": category_id}).to_list(100)
        cat_ids = [category_id] + [str(c["_id"]) for c in subcats]
        query["category_id"] = {"$in": cat_ids}
    if product_brand_id:
        query["product_brand_id"] = product_brand_id
    if car_model_id:
        query["car_model_ids"] = car_model_id
    if car_brand_id:
        models = await db.car_models.find({"brand_id": car_brand_id}).to_list(100)
        model_ids = [str(m["_id"]) for m in models]
        if model_ids:
            query["car_model_ids"] = {"$in": model_ids}
    if min_price is not None:
        query["price"] = {"$gte": min_price}
    if max_price is not None:
        query.setdefault("price", {})["$lte"] = max_price
    
    total = await db.products.count_documents(query)
    products = await db.products.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return {"products": [serialize_doc(p) for p in products], "total": total}

@api_router.get("/products/search")
async def search_products(q: str = Query(..., min_length=1), limit: int = 20):
    regex = {"$regex": q, "$options": "i"}
    products = await db.products.find({"$and": [{"deleted_at": None}, {"$or": [{"name": regex}, {"name_ar": regex}, {"sku": regex}]}]}).limit(limit).to_list(limit)
    car_brands = await db.car_brands.find({"deleted_at": None, "$or": [{"name": regex}, {"name_ar": regex}]}).limit(5).to_list(5)
    car_models = await db.car_models.find({"deleted_at": None, "$or": [{"name": regex}, {"name_ar": regex}]}).limit(5).to_list(5)
    product_brands = await db.product_brands.find({"deleted_at": None, "name": regex}).limit(5).to_list(5)
    categories = await db.categories.find({"deleted_at": None, "$or": [{"name": regex}, {"name_ar": regex}]}).limit(5).to_list(5)
    return {
        "products": [serialize_doc(p) for p in products],
        "car_brands": [serialize_doc(b) for b in car_brands],
        "car_models": [serialize_doc(m) for m in car_models],
        "product_brands": [serialize_doc(b) for b in product_brands],
        "categories": [serialize_doc(c) for c in categories],
    }

@api_router.get("/products/all")
async def get_all_products():
    products = await db.products.find({"deleted_at": None}).sort("created_at", -1).to_list(10000)
    return {"products": [serialize_doc(p) for p in products], "total": len(products)}

@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    product = await db.products.find_one({"_id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    p = serialize_doc(product)
    if p.get("product_brand_id"):
        brand = await db.product_brands.find_one({"_id": p["product_brand_id"]})
        p["product_brand"] = serialize_doc(brand)
    if p.get("category_id"):
        cat = await db.categories.find_one({"_id": p["category_id"]})
        p["category"] = serialize_doc(cat)
    if p.get("car_model_ids"):
        models = await db.car_models.find({"_id": {"$in": p["car_model_ids"]}}).to_list(100)
        p["car_models"] = [serialize_doc(m) for m in models]
    return p

@api_router.post("/products")
async def create_product(product: ProductCreate):
    doc = {"_id": f"prod_{uuid.uuid4().hex[:8]}", **product.dict(), "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None}
    await db.products.insert_one(doc)
    await manager.broadcast({"type": "sync", "tables": ["products"]})
    return serialize_doc(doc)

@api_router.put("/products/{product_id}")
async def update_product(product_id: str, product: ProductCreate):
    await db.products.update_one({"_id": product_id}, {"$set": {**product.dict(), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["products"]})
    return {"message": "Updated"}

@api_router.patch("/products/{product_id}/price")
async def update_product_price(product_id: str, data: dict):
    await db.products.update_one({"_id": product_id}, {"$set": {"price": data.get("price"), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["products"]})
    return {"message": "Price updated"}

@api_router.patch("/products/{product_id}/hidden")
async def update_product_hidden(product_id: str, data: dict):
    await db.products.update_one({"_id": product_id}, {"$set": {"hidden_status": data.get("hidden_status"), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["products"]})
    return {"message": "Updated"}

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    await db.products.update_one({"_id": product_id}, {"$set": {"deleted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["products"]})
    return {"message": "Deleted"}

# ==================== Cart ====================

@api_router.get("/cart")
async def get_cart(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    cart = await db.carts.find_one({"user_id": user["id"]})
    if not cart:
        return {"user_id": user["id"], "items": []}
    items = []
    for item in cart.get("items", []):
        product = await db.products.find_one({"_id": item["product_id"]})
        if product:
            items.append({"product_id": item["product_id"], "quantity": item["quantity"], "product": serialize_doc(product)})
    return {"user_id": user["id"], "items": items}

@api_router.post("/cart/add")
async def add_to_cart(item: CartItemAdd, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    cart = await db.carts.find_one({"user_id": user["id"]})
    if not cart:
        await db.carts.insert_one({"_id": str(uuid.uuid4()), "user_id": user["id"], "items": [{"product_id": item.product_id, "quantity": item.quantity}]})
    else:
        existing = next((i for i in cart.get("items", []) if i["product_id"] == item.product_id), None)
        if existing:
            await db.carts.update_one({"user_id": user["id"], "items.product_id": item.product_id}, {"$inc": {"items.$.quantity": item.quantity}})
        else:
            await db.carts.update_one({"user_id": user["id"]}, {"$push": {"items": {"product_id": item.product_id, "quantity": item.quantity}}})
    return {"message": "Added"}

@api_router.put("/cart/update")
async def update_cart(item: CartItemAdd, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if item.quantity <= 0:
        await db.carts.update_one({"user_id": user["id"]}, {"$pull": {"items": {"product_id": item.product_id}}})
    else:
        await db.carts.update_one({"user_id": user["id"], "items.product_id": item.product_id}, {"$set": {"items.$.quantity": item.quantity}})
    return {"message": "Updated"}

@api_router.delete("/cart/clear")
async def clear_cart(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": []}})
    return {"message": "Cleared"}

# ==================== Orders ====================

@api_router.get("/orders")
async def get_orders(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    orders = await db.orders.find({"user_id": user["id"]}).sort("created_at", -1).to_list(1000)
    return [serialize_doc(o) for o in orders]

@api_router.get("/orders/all")
async def get_all_orders():
    orders = await db.orders.find({}).sort("created_at", -1).to_list(10000)
    return {"orders": [serialize_doc(o) for o in orders], "total": len(orders)}

@api_router.post("/orders")
async def create_order(order_data: OrderCreate, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    cart = await db.carts.find_one({"user_id": user["id"]})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart empty")
    
    subtotal = 0
    order_items = []
    for item in cart["items"]:
        product = await db.products.find_one({"_id": item["product_id"]})
        if product:
            subtotal += product["price"] * item["quantity"]
            order_items.append({"product_id": item["product_id"], "product_name": product["name"], "product_name_ar": product.get("name_ar"), "quantity": item["quantity"], "price": product["price"], "image_url": product.get("image_url")})
    
    shipping = 150.0
    order = {
        "_id": str(uuid.uuid4()),
        "order_number": f"ORD-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}",
        "user_id": user["id"],
        "customer_name": f"{order_data.first_name} {order_data.last_name}",
        "customer_email": order_data.email,
        "phone": order_data.phone,
        "subtotal": subtotal,
        "shipping_cost": shipping,
        "total": subtotal + shipping,
        "status": "pending",
        "payment_method": order_data.payment_method,
        "notes": order_data.notes,
        "delivery_address": {"street_address": order_data.street_address, "city": order_data.city, "state": order_data.state, "country": order_data.country, "delivery_instructions": order_data.delivery_instructions},
        "items": order_items,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.orders.insert_one(order)
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": []}})
    await manager.broadcast({"type": "sync", "tables": ["orders"]})
    return serialize_doc(order)

@api_router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str):
    valid = ["pending", "preparing", "shipped", "out_for_delivery", "delivered", "cancelled", "complete"]
    if status not in valid:
        raise HTTPException(status_code=400, detail="Invalid status")
    await db.orders.update_one({"_id": order_id}, {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "order_update", "order_id": order_id, "status": status})
    return {"message": "Updated"}

# ==================== Favorites ====================

@api_router.get("/favorites")
async def get_favorites(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    favs = await db.favorites.find({"user_id": user["id"], "deleted_at": None}).to_list(1000)
    result = []
    for f in favs:
        product = await db.products.find_one({"_id": f["product_id"]})
        if product:
            result.append({**serialize_doc(f), "product": serialize_doc(product)})
    return {"favorites": result, "total": len(result)}

@api_router.get("/favorites/check/{product_id}")
async def check_favorite(product_id: str, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    fav = await db.favorites.find_one({"user_id": user["id"], "product_id": product_id, "deleted_at": None})
    return {"is_favorite": fav is not None}

@api_router.post("/favorites/toggle")
async def toggle_favorite(data: FavoriteAdd, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    existing = await db.favorites.find_one({"user_id": user["id"], "product_id": data.product_id})
    if existing:
        if existing.get("deleted_at"):
            await db.favorites.update_one({"_id": existing["_id"]}, {"$set": {"deleted_at": None, "updated_at": datetime.now(timezone.utc)}})
            return {"is_favorite": True}
        else:
            await db.favorites.update_one({"_id": existing["_id"]}, {"$set": {"deleted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
            return {"is_favorite": False}
    else:
        await db.favorites.insert_one({"_id": str(uuid.uuid4()), "user_id": user["id"], "product_id": data.product_id, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None})
        return {"is_favorite": True}

# ==================== Comments ====================

@api_router.get("/products/{product_id}/comments")
async def get_comments(product_id: str, request: Request, skip: int = 0, limit: int = 50):
    user = await get_current_user(request)
    user_id = user["id"] if user else None
    comments = await db.comments.find({"product_id": product_id, "deleted_at": None}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    pipeline = [{"$match": {"product_id": product_id, "deleted_at": None, "rating": {"$ne": None}}}, {"$group": {"_id": None, "count": {"$sum": 1}, "avg": {"$avg": "$rating"}}}]
    stats = await db.comments.aggregate(pipeline).to_list(1)
    avg_rating = round(stats[0]["avg"], 1) if stats and stats[0].get("avg") else None
    rating_count = stats[0]["count"] if stats else 0
    return {"comments": [{**serialize_doc(c), "is_owner": c.get("user_id") == user_id} for c in comments], "total": len(comments), "avg_rating": avg_rating, "rating_count": rating_count}

@api_router.post("/products/{product_id}/comments")
async def add_comment(product_id: str, data: CommentCreate, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if data.rating and (data.rating < 1 or data.rating > 5):
        raise HTTPException(status_code=400, detail="Rating must be 1-5")
    comment = {"_id": str(uuid.uuid4()), "product_id": product_id, "user_id": user["id"], "user_name": user["name"], "user_picture": user.get("picture"), "text": data.text, "rating": data.rating, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None}
    await db.comments.insert_one(comment)
    return {**serialize_doc(comment), "is_owner": True}

# ==================== Customers ====================

@api_router.get("/customers")
async def get_customers():
    customers = await db.users.find({"deleted_at": None}).sort("created_at", -1).to_list(10000)
    return {"customers": [serialize_doc(c) for c in customers], "total": len(customers)}

@api_router.get("/customers/{customer_id}")
async def get_customer(customer_id: str):
    customer = await db.users.find_one({"_id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Not found")
    orders = await db.orders.find({"user_id": customer_id}).to_list(1000)
    return {**serialize_doc(customer), "orders": [serialize_doc(o) for o in orders], "orders_count": len(orders)}

# ==================== Sync Endpoint for React Query ====================

@api_router.post("/sync/pull")
async def sync_pull(request: SyncPullRequest):
    """Pull changes since last timestamp for offline sync"""
    last_pulled_at = request.last_pulled_at or 0
    tables = request.tables or ["car_brands", "car_models", "product_brands", "categories", "products"]
    last_dt = datetime.fromtimestamp(last_pulled_at / 1000, tz=timezone.utc) if last_pulled_at else datetime.min.replace(tzinfo=timezone.utc)
    
    changes = {}
    for table in tables:
        coll = db[table]
        created = await coll.find({"created_at": {"$gt": last_dt}, "deleted_at": None}).to_list(10000)
        updated = await coll.find({"updated_at": {"$gt": last_dt}, "created_at": {"$lte": last_dt}, "deleted_at": None}).to_list(10000)
        deleted = await coll.find({"deleted_at": {"$gt": last_dt}}).to_list(10000)
        changes[table] = {
            "created": [serialize_doc(d) for d in created],
            "updated": [serialize_doc(d) for d in updated],
            "deleted": [str(d["_id"]) for d in deleted],
        }
    
    return {"changes": changes, "timestamp": get_timestamp_ms()}

# ==================== WebSocket ====================

@api_router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# ==================== Seed & Health ====================

@api_router.post("/seed")
async def seed_database():
    count = await db.car_brands.count_documents({})
    if count > 0:
        return {"message": "Already seeded"}
    
    # Car Brands
    await db.car_brands.insert_many([
        {"_id": "cb_toyota", "name": "Toyota", "name_ar": "تويوتا", "logo": None, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cb_mitsubishi", "name": "Mitsubishi", "name_ar": "ميتسوبيشي", "logo": None, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cb_mazda", "name": "Mazda", "name_ar": "مازدا", "logo": None, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
    ])
    
    # Car Models
    await db.car_models.insert_many([
        {"_id": "cm_camry", "brand_id": "cb_toyota", "name": "Camry", "name_ar": "كامري", "year_start": 2018, "year_end": 2024, "image_url": None, "variants": [], "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cm_corolla", "brand_id": "cb_toyota", "name": "Corolla", "name_ar": "كورولا", "year_start": 2019, "year_end": 2024, "image_url": None, "variants": [], "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cm_hilux", "brand_id": "cb_toyota", "name": "Hilux", "name_ar": "هايلكس", "year_start": 2016, "year_end": 2024, "image_url": None, "variants": [], "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cm_lancer", "brand_id": "cb_mitsubishi", "name": "Lancer", "name_ar": "لانسر", "year_start": 2015, "year_end": 2020, "image_url": None, "variants": [], "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cm_pajero", "brand_id": "cb_mitsubishi", "name": "Pajero", "name_ar": "باجيرو", "year_start": 2016, "year_end": 2024, "image_url": None, "variants": [], "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cm_mazda3", "brand_id": "cb_mazda", "name": "Mazda 3", "name_ar": "مازدا 3", "year_start": 2019, "year_end": 2024, "image_url": None, "variants": [], "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cm_cx5", "brand_id": "cb_mazda", "name": "CX-5", "name_ar": "سي اكس 5", "year_start": 2017, "year_end": 2024, "image_url": None, "variants": [], "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
    ])
    
    # Product Brands
    await db.product_brands.insert_many([
        {"_id": "pb_kby", "name": "KBY", "name_ar": None, "logo": None, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "pb_ctr", "name": "CTR", "name_ar": None, "logo": None, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "pb_art", "name": "ART", "name_ar": None, "logo": None, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
    ])
    
    # Categories
    await db.categories.insert_many([
        {"_id": "cat_engine", "name": "Engine", "name_ar": "المحرك", "parent_id": None, "icon": "engine", "sort_order": 1, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_suspension", "name": "Suspension", "name_ar": "نظام التعليق", "parent_id": None, "icon": "car-suspension", "sort_order": 2, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_clutch", "name": "Clutch", "name_ar": "الكلتش", "parent_id": None, "icon": "car-clutch", "sort_order": 3, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_electricity", "name": "Electricity", "name_ar": "الكهرباء", "parent_id": None, "icon": "lightning-bolt", "sort_order": 4, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_body", "name": "Body", "name_ar": "البودي", "parent_id": None, "icon": "car-door", "sort_order": 5, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_tires", "name": "Tires", "name_ar": "الإطارات", "parent_id": None, "icon": "car-tire-alert", "sort_order": 6, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_filters", "name": "Filters", "name_ar": "الفلاتر", "parent_id": "cat_engine", "icon": "filter", "sort_order": 1, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_spark_plugs", "name": "Spark Plugs", "name_ar": "شمعات الاشتعال", "parent_id": "cat_engine", "icon": "flash", "sort_order": 2, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_shock_absorbers", "name": "Shock Absorbers", "name_ar": "ممتص الصدمات", "parent_id": "cat_suspension", "icon": "car-brake-abs", "sort_order": 1, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_batteries", "name": "Batteries", "name_ar": "البطاريات", "parent_id": "cat_electricity", "icon": "battery", "sort_order": 1, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_headlights", "name": "Headlights", "name_ar": "المصابيح الأمامية", "parent_id": "cat_electricity", "icon": "lightbulb", "sort_order": 2, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_mirrors", "name": "Mirrors", "name_ar": "المرايا", "parent_id": "cat_body", "icon": "flip-horizontal", "sort_order": 1, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
    ])
    
    # Products
    await db.products.insert_many([
        {"_id": "prod_oil_filter_1", "name": "Toyota Oil Filter", "name_ar": "فلتر زيت تويوتا", "price": 45.99, "sku": "TOY-OIL-001", "category_id": "cat_filters", "product_brand_id": "pb_kby", "car_model_ids": ["cm_camry", "cm_corolla"], "image_url": None, "images": [], "stock_quantity": 50, "hidden_status": False, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "prod_air_filter_1", "name": "Camry Air Filter", "name_ar": "فلتر هواء كامري", "price": 35.50, "sku": "CAM-AIR-001", "category_id": "cat_filters", "product_brand_id": "pb_ctr", "car_model_ids": ["cm_camry"], "image_url": None, "images": [], "stock_quantity": 30, "hidden_status": False, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "prod_spark_plug_1", "name": "Iridium Spark Plugs Set", "name_ar": "طقم شمعات إريديوم", "price": 89.99, "sku": "SPK-IRD-001", "category_id": "cat_spark_plugs", "product_brand_id": "pb_art", "car_model_ids": ["cm_camry", "cm_corolla", "cm_lancer"], "image_url": None, "images": [], "stock_quantity": 25, "hidden_status": False, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "prod_shock_1", "name": "Front Shock Absorber", "name_ar": "ممتص صدمات أمامي", "price": 125.00, "sku": "SHK-FRT-001", "category_id": "cat_shock_absorbers", "product_brand_id": "pb_kby", "car_model_ids": ["cm_hilux", "cm_pajero"], "image_url": None, "images": [], "stock_quantity": 15, "hidden_status": False, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "prod_battery_1", "name": "Car Battery 70Ah", "name_ar": "بطارية سيارة 70 أمبير", "price": 185.00, "sku": "BAT-70A-001", "category_id": "cat_batteries", "product_brand_id": "pb_art", "car_model_ids": ["cm_camry", "cm_corolla", "cm_hilux", "cm_pajero"], "image_url": None, "images": [], "stock_quantity": 20, "hidden_status": False, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "prod_headlight_1", "name": "LED Headlight Bulb H7", "name_ar": "لمبة فانوس LED H7", "price": 55.00, "sku": "LED-H7-001", "category_id": "cat_headlights", "product_brand_id": "pb_kby", "car_model_ids": ["cm_mazda3", "cm_cx5"], "image_url": None, "images": [], "stock_quantity": 40, "hidden_status": False, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "prod_mirror_1", "name": "Side Mirror Right", "name_ar": "مرآة جانبية يمين", "price": 145.00, "sku": "MIR-R-001", "category_id": "cat_mirrors", "product_brand_id": "pb_ctr", "car_model_ids": ["cm_camry"], "image_url": None, "images": [], "stock_quantity": 10, "hidden_status": False, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "prod_clutch_kit_1", "name": "Complete Clutch Kit", "name_ar": "طقم كلتش كامل", "price": 299.99, "sku": "CLT-KIT-001", "category_id": "cat_clutch", "product_brand_id": "pb_ctr", "car_model_ids": ["cm_lancer", "cm_mazda3"], "image_url": None, "images": [], "stock_quantity": 8, "hidden_status": False, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
    ])
    
    return {"message": "Database seeded"}

@api_router.get("/")
async def root():
    return {"message": "Al-Ghazaly Auto Parts API v2.0", "status": "running", "architecture": "offline-first"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "database": "mongodb"}

# Include router
app.include_router(api_router)

app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
async def startup():
    global client, db
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    logger.info("Connected to MongoDB")
    count = await db.car_brands.count_documents({})
    if count == 0:
        logger.info("Seeding database...")
        await seed_database()

@app.on_event("shutdown")
async def shutdown():
    client.close()
