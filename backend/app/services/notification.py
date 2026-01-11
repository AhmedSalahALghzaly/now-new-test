"""
Notification Service
"""
from datetime import datetime, timezone
import uuid
from ..core.database import db
from ..core.security import serialize_doc
from .websocket import manager

async def create_notification(user_id: str, title: str, message: str, notif_type: str = "info", extra_data: dict = None):
    """Create and broadcast a notification"""
    notification = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": notif_type,
        "read": False,
        "created_at": datetime.now(timezone.utc),
    }
    if extra_data:
        notification.update(extra_data)
    await db.notifications.insert_one(notification)
    await manager.send_notification(user_id, serialize_doc(notification))
    return notification
