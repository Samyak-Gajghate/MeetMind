from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

app = FastAPI(title="MeetMind API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.admin import router as admin_router
from app.api.meetings import router as meetings_router
from app.api.action_items import router as action_items_router
from app.api.search import router as search_router
from app.api.notifications import router as notifications_router
from app.api.activity_logs import router as activity_logs_router

app.include_router(auth_router, prefix="/v1")
app.include_router(users_router, prefix="/v1")
app.include_router(admin_router, prefix="/v1")
app.include_router(meetings_router, prefix="/v1")
app.include_router(action_items_router, prefix="/v1")
app.include_router(search_router, prefix="/v1")
app.include_router(notifications_router, prefix="/v1")
app.include_router(activity_logs_router, prefix="/v1")

@app.get("/health")
async def health_check():
    return {"status": "ok"}
