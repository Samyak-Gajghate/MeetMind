from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core import deps
from app.models.user import User
from app.models.meeting import Meeting

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/stats")
async def get_workspace_stats(
    db: AsyncSession = Depends(deps.get_db),
    current_admin: User = Depends(deps.get_current_admin)
):
    users_result = await db.execute(
        select(func.count(User.id)).where(User.workspace_id == current_admin.workspace_id, User.is_active == True)
    )
    total_users = users_result.scalar_one_or_none() or 0
    
    meetings_result = await db.execute(
        select(func.count(Meeting.id)).where(Meeting.workspace_id == current_admin.workspace_id)
    )
    total_meetings = meetings_result.scalar_one_or_none() or 0
    
    return {
        "workspace_id": current_admin.workspace_id,
        "total_active_users": total_users,
        "total_meetings": total_meetings
    }
