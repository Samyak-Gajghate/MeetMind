from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import List, Dict, Any

from app.core import deps
from app.models.user import User

router = APIRouter(prefix="/search", tags=["search"])

@router.get("/")
async def global_search(
    q: str = Query(..., min_length=2),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    workspace_id = str(current_user.workspace_id)
    
    sql_query = """
    SELECT 'meeting' as type, id::text, title as snippet, created_at 
    FROM meetings 
    WHERE workspace_id = :ws_id AND deleted_at IS NULL AND title ILIKE :q
    UNION ALL
    SELECT 'action_item' as type, a.id::text, a.description as snippet, a.created_at
    FROM action_items a
    JOIN meetings m ON a.meeting_id = m.id
    WHERE m.workspace_id = :ws_id AND a.deleted_at IS NULL AND a.description ILIKE :q
    UNION ALL
    SELECT 'decision' as type, d.id::text, d.description as snippet, d.created_at
    FROM decisions d
    JOIN meetings m ON d.meeting_id = m.id
    WHERE m.workspace_id = :ws_id AND d.description ILIKE :q
    ORDER BY created_at DESC
    LIMIT 20;
    """
    
    result = await db.execute(text(sql_query), {"ws_id": workspace_id, "q": f"%{q}%"})
    rows = result.fetchall()
    
    formatted_results = []
    for row in rows:
        formatted_results.append({
            "type": row.type,
            "id": row.id,
            "snippet": row.snippet,
            "created_at": row.created_at
        })
        
    return {"results": formatted_results}
