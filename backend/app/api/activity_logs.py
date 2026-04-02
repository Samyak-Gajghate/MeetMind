from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.core import deps
from app.models.user import User
from app.models.activity_log import ActivityLog
from app.schemas.activity_log import ActivityLogRead

router = APIRouter(prefix="/activity_logs", tags=["activity_logs"])

@router.get("/", response_model=List[ActivityLogRead])
async def get_activity_logs(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(deps.get_db),
    current_admin: User = Depends(deps.get_current_admin)
):
    query = (
        select(ActivityLog)
        .join(User, ActivityLog.user_id == User.id)
        .where(User.workspace_id == current_admin.workspace_id)
        .order_by(ActivityLog.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    return result.scalars().all()
