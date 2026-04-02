from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core import deps
from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.meeting import Meeting
from app.models.transcript import Transcript
from app.models.processing_job import ProcessingJob
from app.models.meeting_summary import MeetingSummary
from app.models.action_item import ActionItem
from app.models.decision import Decision
from app.schemas.meeting import MeetingCreate, MeetingRead, MeetingUploadResponse, MeetingDetailRead, ActionItemRead, DecisionRead
from app.services import storage, gemini
from datetime import datetime, timezone
import httpx

router = APIRouter(prefix="/meetings", tags=["meetings"])

@router.post("/", response_model=MeetingUploadResponse, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    meeting_in: MeetingCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    if str(current_user.workspace_id) != str(meeting_in.workspace_id):
        raise HTTPException(status_code=403, detail="Workspace mismatch")

    meeting = Meeting(
        workspace_id=meeting_in.workspace_id,
        uploaded_by_user_id=current_user.id,
        title=meeting_in.title,
        meeting_date=meeting_in.meeting_date,
        duration_minutes=meeting_in.duration_minutes,
        participant_names=meeting_in.participant_names,
        status="pending"
    )
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)

    upload_info = storage.generate_upload_url(
        workspace_id=str(meeting_in.workspace_id),
        meeting_id=str(meeting.id),
        filename=meeting_in.filename
    )
    
    transcript = Transcript(
        meeting_id=meeting.id,
        storage_uri=upload_info["full_supabase_uri"],
        file_name=meeting_in.filename
    )
    db.add(transcript)
    await db.commit()

    return {
        "meeting": meeting,
        "upload_url": upload_info["upload_url"],
        "storage_path": upload_info["path"],
        "upload_token": upload_info.get("token")
    }

async def process_meeting_task(meeting_id: str, trigger_user_id: str):
    async with AsyncSessionLocal() as db:
        job = None
        mtg = None
        try:
            # 1. Update Job Status
            result = await db.execute(select(ProcessingJob).where(ProcessingJob.meeting_id == meeting_id).order_by(ProcessingJob.created_at.desc()))
            job = result.scalars().first()
            if not job:
                job = ProcessingJob(meeting_id=meeting_id, triggered_by_user_id=trigger_user_id, status="processing")
                db.add(job)
            else:
                job.status = "processing"
            
            mtg_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
            mtg = mtg_result.scalar_one()
            mtg.status = "processing"
            
            ts_result = await db.execute(select(Transcript).where(Transcript.meeting_id == meeting_id))
            transcript = ts_result.scalar_one()
            
            await db.commit()

            # 2. Download Transcript
            download_url = storage.generate_download_url(transcript.storage_uri)
            async with httpx.AsyncClient() as client:
                r = await client.get(download_url)
                if r.status_code != 200:
                    raise Exception("Failed to download transcript from storage")
                transcript_text = r.text
                
            transcript.raw_text = transcript_text
            
            # 3. Process via Gemini
            processed_data = await gemini.process_meeting_transcript(transcript_text)
            
            # 4. Save results
            summary = MeetingSummary(meeting_id=meeting_id, job_id=job.id, summary_text=processed_data.summary)
            db.add(summary)
            
            for item in processed_data.action_items:
                ai = ActionItem(
                    meeting_id=meeting_id, 
                    job_id=job.id, 
                    description=item.description, 
                    owner_name=item.owner_name, 
                    due_date=item.due_date, 
                    priority=item.priority
                )
                db.add(ai)
                
            for dec in processed_data.decisions:
                d = Decision(meeting_id=meeting_id, job_id=job.id, description=dec.description)
                db.add(d)

            job.status = "completed"
            job.completed_at = datetime.now(timezone.utc)
            job.raw_gemini_response = processed_data.model_dump(mode="json")
            mtg.status = "processed"
            
            await db.commit()
            
        except Exception as e:
            if job:
                job.status = "failed"
                job.error_message = str(e)
            if mtg:
                mtg.status = "failed"
            await db.commit()


@router.post("/{meeting_id}/process", status_code=status.HTTP_202_ACCEPTED)
async def trigger_processing(
    meeting_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id, Meeting.workspace_id == current_user.workspace_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    background_tasks.add_task(process_meeting_task, meeting_id, str(current_user.id))
    return {"status": "processing_queued"}


@router.get("/", response_model=list[MeetingRead])
async def list_meetings(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    result = await db.execute(
        select(Meeting)
        .where(Meeting.workspace_id == current_user.workspace_id, Meeting.deleted_at.is_(None))
        .order_by(Meeting.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/{meeting_id}", response_model=MeetingDetailRead)
async def get_meeting_detail(
    meeting_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id, Meeting.workspace_id == current_user.workspace_id, Meeting.deleted_at.is_(None)))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    summary_res = await db.execute(select(MeetingSummary.summary_text).where(MeetingSummary.meeting_id == meeting_id))
    summary_text = summary_res.scalar_one_or_none()
    
    ais_res = await db.execute(select(ActionItem).where(ActionItem.meeting_id == meeting_id))
    action_items = ais_res.scalars().all()
    
    decisions_res = await db.execute(select(Decision).where(Decision.meeting_id == meeting_id))
    decisions = decisions_res.scalars().all()
    
    response_data = MeetingDetailRead.model_validate(meeting).model_dump()
    response_data["summary"] = summary_text
    response_data["action_items"] = [ActionItemRead.model_validate(ai).model_dump() for ai in action_items]
    response_data["decisions"] = [DecisionRead.model_validate(d).model_dump() for d in decisions]
    
    return response_data
