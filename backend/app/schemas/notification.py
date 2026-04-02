from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional

class NotificationRead(BaseModel):
    id: UUID
    type: str
    message: str
    related_meeting_id: Optional[UUID]
    related_action_item_id: Optional[UUID]
    is_read: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
