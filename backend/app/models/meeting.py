from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Date, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, ARRAY, TSVECTOR
from sqlalchemy.sql import func
import uuid
from app.database import Base

class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    uploaded_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    meeting_date = Column(Date, nullable=False, index=True)
    duration_minutes = Column(Integer)
    participant_names = Column(ARRAY(String), nullable=False, server_default='{}')
    status = Column(String(50), nullable=False, server_default="pending", index=True)
    deleted_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    search_vector = Column(TSVECTOR)

    __table_args__ = (
        CheckConstraint('duration_minutes > 0', name='duration_minutes_check'),
        CheckConstraint(status.in_(['pending', 'processing', 'processed', 'failed']), name='status_check'),
    )
