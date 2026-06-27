from pydantic import BaseModel, ConfigDict, field_validator
from uuid import UUID
from datetime import datetime
from typing import Optional

def validate_email_address(v: str) -> str:
    v = v.strip().lower()
    if "@" not in v or "." not in v.split("@")[-1]:
        raise ValueError("Invalid email format")
    return v

class UserRead(BaseModel):
    id: UUID
    workspace_id: UUID
    email: str
    display_name: str
    role: str
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return validate_email_address(v)

class UserCreate(BaseModel):
    email: str
    password: str
    display_name: str
    workspace_id: UUID

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return validate_email_address(v)

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return validate_email_address(v)

class RefreshRequest(BaseModel):
    refresh_token: str
