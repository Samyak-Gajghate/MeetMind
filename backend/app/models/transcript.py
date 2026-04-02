from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.database import Base

class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, unique=True)
    storage_uri = Column(String(1000))
    raw_text = Column(Text)
    file_name = Column(String(500))
    file_size_bytes = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
