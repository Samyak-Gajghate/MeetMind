from pydantic import BaseModel
from typing import List, Optional
from datetime import date

class ActionItemResult(BaseModel):
    description: str
    owner_name: Optional[str] = None
    due_date: Optional[date] = None
    priority: str = "medium"

class DecisionResult(BaseModel):
    description: str

class GeminiProcessedResponse(BaseModel):
    summary: str
    action_items: List[ActionItemResult]
    decisions: List[DecisionResult]
