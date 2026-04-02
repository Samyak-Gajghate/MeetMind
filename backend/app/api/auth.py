from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
import secrets

from app.core import security, deps
from app.models.user import User
from app.models.workspace import Workspace
from app.models.refresh_token import RefreshToken
from app.schemas.user import UserCreate, UserRead, TokenResponse, LoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: AsyncSession = Depends(deps.get_db)):
    result = await db.execute(select(Workspace).where(Workspace.id == user_in.workspace_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Invalid workspace ID")
        
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User with this email already exists")

    hashed_password = security.get_password_hash(user_in.password)
    user = User(
        workspace_id=user_in.workspace_id,
        email=user_in.email,
        password_hash=hashed_password,
        display_name=user_in.display_name,
        role="team_member"
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.post("/login", response_model=TokenResponse)
async def login(response: Response, request: LoginRequest, db: AsyncSession = Depends(deps.get_db)):
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()
    
    if not user or not security.verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
        
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")

    user.last_active_at = datetime.now(timezone.utc)
    
    access_token = security.create_access_token(subject=str(user.id))
    
    raw_rt_secret = secrets.token_urlsafe(32)
    hashed_rt = security.get_password_hash(raw_rt_secret)
    
    db_rt = RefreshToken(
        user_id=user.id,
        token_hash=hashed_rt,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )
    db.add(db_rt)
    await db.commit()
    await db.refresh(db_rt)
    
    cookie_value = f"{db_rt.id}::{raw_rt_secret}"
    response.set_cookie(
        key="refresh_token",
        value=cookie_value,
        httponly=True,
        secure=True, 
        samesite="strict",
        max_age=7 * 24 * 60 * 60
    )

    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(deps.get_db)):
    cookie_value = request.cookies.get("refresh_token")
    if not cookie_value or "::" not in cookie_value:
        raise HTTPException(status_code=401, detail="Refresh token missing or malformed")
        
    rt_id_str, raw_secret = cookie_value.split("::", 1)
    
    try:
        result = await db.execute(select(RefreshToken).where(RefreshToken.id == rt_id_str, RefreshToken.revoked == False))
        db_rt = result.scalar_one_or_none()
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token identifier")
        
    if not db_rt or db_rt.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Refresh token expired or invalid")
        
    if not security.verify_password(raw_secret, db_rt.token_hash):
        raise HTTPException(status_code=401, detail="Invalid refresh token")
        
    user_result = await db.execute(select(User).where(User.id == db_rt.user_id))
    user = user_result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User inactive or deleted")
        
    access_token = security.create_access_token(subject=str(user.id))
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(deps.get_db)):
    cookie_value = request.cookies.get("refresh_token")
    if cookie_value and "::" in cookie_value:
        rt_id_str, raw_secret = cookie_value.split("::", 1)
        try:
            result = await db.execute(select(RefreshToken).where(RefreshToken.id == rt_id_str))
            db_rt = result.scalar_one_or_none()
            if db_rt and security.verify_password(raw_secret, db_rt.token_hash):
                db_rt.revoked = True
                await db.commit()
        except Exception:
            pass
            
    response.delete_cookie(key="refresh_token")
    return {"message": "Logged out successfully"}

@router.get("/me", response_model=UserRead)
async def get_me(current_user: User = Depends(deps.get_current_user)):
    return current_user
