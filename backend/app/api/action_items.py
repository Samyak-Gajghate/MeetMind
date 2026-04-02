from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List

from app.core import deps
from app.models.user import User
from app.models.action_item import ActionItem
from app.models.meeting import Meeting
from app.schemas.action_item import ActionItemUpdate
from app.schemas.meeting import ActionItemRead

router = APIRouter(prefix="/action_items", tags=["action_items"])

@router.get("/", response_model=List[ActionItemRead])
async def list_action_items(
    status_filter: Optional[str] = None,
    owner_name: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    query = (
        select(ActionItem)
        .join(Meeting, ActionItem.meeting_id == Meeting.id)
        .where(Meeting.workspace_id == current_user.workspace_id, ActionItem.deleted_at.is_(None))
    )
    
    if status_filter:
        query = query.where(ActionItem.status == status_filter)
    if owner_name:
        query = query.where(ActionItem.owner_name.ilike(f"%{owner_name}%"))
        
    query = query.order_by(ActionItem.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.patch("/{item_id}", response_model=ActionItemRead)
async def update_action_item(
    item_id: str,
    item_update: ActionItemUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    query = (
        select(ActionItem)
        .join(Meeting, ActionItem.meeting_id == Meeting.id)
        .where(
            ActionItem.id == item_id, 
            Meeting.workspace_id == current_user.workspace_id,
            ActionItem.deleted_at.is_(None)
        )
    )
    result = await db.execute(query)
    ai = result.scalar_one_or_none()
    
    if not ai:
        raise HTTPException(status_code=404, detail="Action item not found")
        
    update_data = item_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(ai, field, value)
        
    ai.updated_by_user_id = current_user.id
    await db.commit()
    await db.refresh(ai)
    return ai
