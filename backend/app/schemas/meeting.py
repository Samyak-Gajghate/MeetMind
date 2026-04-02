from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime, date
from typing import List, Optional

class MeetingCreate(BaseModel):
    workspace_id: UUID
    title: str
    meeting_date: date
    duration_minutes: int
    participant_names: List[str]
    filename: str

class MeetingRead(BaseModel):
    id: UUID
    workspace_id: UUID
    uploaded_by_user_id: UUID
    title: str
    meeting_date: date
    duration_minutes: int
    participant_names: List[str]
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class MeetingUploadResponse(BaseModel):
    meeting: MeetingRead
    upload_url: str
    storage_path: str
    upload_token: Optional[str] = None

class ActionItemRead(BaseModel):
    id: UUID
    description: str
    owner_name: Optional[str]
    due_date: Optional[date]
    priority: str
    status: str
    model_config = ConfigDict(from_attributes=True)

class DecisionRead(BaseModel):
    id: UUID
    description: str
    model_config = ConfigDict(from_attributes=True)

class MeetingDetailRead(MeetingRead):
    summary: Optional[str] = None
    action_items: List[ActionItemRead] = []
    decisions: List[DecisionRead] = []
