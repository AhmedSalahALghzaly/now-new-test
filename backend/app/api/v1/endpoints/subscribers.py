"""
Subscriber Routes
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid

from ....core.database import db
from ....core.config import PRIMARY_OWNER_EMAIL
from ....core.security import get_current_user, get_user_role, serialize_doc
from ....models.schemas import SubscriberCreate, SubscriptionRequestCreate
from ....services.websocket import manager
from ....services.notification import create_notification

router = APIRouter()

# Subscriber routes
@router.get("/subscribers")
async def get_subscribers(request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    subscribers = await db.subscribers.find({"deleted_at": None}).to_list(1000)
    return [serialize_doc(s) for s in subscribers]

@router.post("/subscribers")
async def add_subscriber(data: SubscriberCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    existing = await db.subscribers.find_one({"email": data.email, "deleted_at": None})
    if existing:
        raise HTTPException(status_code=400, detail="Subscriber already exists")
    
    subscriber = {
        "_id": str(uuid.uuid4()),
        "email": data.email,
        "name": data.email.split("@")[0],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None,
    }
    await db.subscribers.insert_one(subscriber)
    await manager.broadcast({"type": "sync", "tables": ["subscribers"]})
    return serialize_doc(subscriber)

@router.delete("/subscribers/{subscriber_id}")
async def delete_subscriber(subscriber_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.subscribers.update_one({"_id": subscriber_id}, {"$set": {"deleted_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["subscribers"]})
    return {"message": "Deleted"}

# Subscription Request routes
@router.get("/subscription-requests")
async def get_subscription_requests(request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    requests = await db.subscription_requests.find({"deleted_at": None}).sort("created_at", -1).to_list(1000)
    return [serialize_doc(r) for r in requests]

@router.post("/subscription-requests")
async def create_subscription_request(data: SubscriptionRequestCreate):
    request_doc = {
        "_id": str(uuid.uuid4()),
        **data.dict(),
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None,
    }
    await db.subscription_requests.insert_one(request_doc)
    
    owner = await db.users.find_one({"email": PRIMARY_OWNER_EMAIL})
    if owner:
        await create_notification(
            str(owner["_id"]),
            "New Subscription Request",
            f"New subscription request from {data.customer_name}",
            "info"
        )
    
    await manager.broadcast({"type": "sync", "tables": ["subscription_requests"]})
    return serialize_doc(request_doc)

@router.patch("/subscription-requests/{request_id}/approve")
async def approve_subscription_request(request_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get the subscription request
    sub_request = await db.subscription_requests.find_one({"_id": request_id})
    if not sub_request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Check if subscriber already exists with this phone
    existing = await db.subscribers.find_one({
        "phone": sub_request.get("phone"),
        "deleted_at": None
    })
    
    if not existing:
        # Create new subscriber from request data
        subscriber = {
            "_id": str(uuid.uuid4()),
            "name": sub_request.get("customer_name", ""),
            "phone": sub_request.get("phone", ""),
            "email": sub_request.get("email", ""),
            "governorate": sub_request.get("governorate", ""),
            "village": sub_request.get("village", ""),
            "address": sub_request.get("address", ""),
            "car_model": sub_request.get("car_model", ""),
            "customer_id": sub_request.get("customer_id"),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "deleted_at": None,
        }
        await db.subscribers.insert_one(subscriber)
    
    # Update request status to approved
    await db.subscription_requests.update_one(
        {"_id": request_id},
        {"$set": {"status": "approved", "updated_at": datetime.now(timezone.utc)}}
    )
    
    # Broadcast sync update
    await manager.broadcast({"type": "sync", "tables": ["subscribers", "subscription_requests"]})
    
    return {"message": "Approved"}

@router.delete("/subscription-requests/{request_id}")
async def delete_subscription_request(request_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.subscription_requests.update_one({"_id": request_id}, {"$set": {"deleted_at": datetime.now(timezone.utc)}})
    return {"message": "Deleted"}
