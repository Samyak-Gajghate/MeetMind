from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Date, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, TSVECTOR
from sqlalchemy.sql import func
import uuid
from app.database import Base

class ActionItem(Base):
    __tablename__ = "action_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(UUID(as_uuid=True), ForeignKey("processing_jobs.id"), nullable=False)
    description = Column(Text, nullable=False)
    owner_name = Column(String(255), index=True)
    due_date = Column(Date, index=True)
    priority = Column(String(20), nullable=False, server_default="medium")
    status = Column(String(50), nullable=False, server_default="open", index=True)
    updated_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    deleted_at = Column(DateTime(timezone=True))
    search_vector = Column(TSVECTOR)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint(priority.in_(['high', 'medium', 'low']), name='priority_check'),
        CheckConstraint(status.in_(['open', 'in_progress', 'done']), name='status_check'),
    )
