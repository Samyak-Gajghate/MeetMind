from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from app.database import Base

class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    triggered_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    status = Column(String(50), nullable=False, server_default="queued", index=True)
    attempt_count = Column(Integer, nullable=False, server_default="0")
    error_message = Column(Text)
    raw_gemini_response = Column(JSONB)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint(status.in_(['queued', 'processing', 'completed', 'failed']), name='status_check'),
    )
