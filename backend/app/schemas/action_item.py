from pydantic import BaseModel
from datetime import date
from typing import Optional

class ActionItemUpdate(BaseModel):
    status: Optional[str] = None
    owner_name: Optional[str] = None
    due_date: Optional[date] = None
    priority: Optional[str] = None
