from datetime import datetime, timezone
from typing import Any, Optional
from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.agent import build_system_prompt, run_ziri_agent, synthesize_ziri_voice
from app.auth import AuthContext, get_auth_context
from app.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "Enterprise Python FastAPI Core Engine for OKIKE & Coach Ziri. "
        "Powers Internal OKIKE Operations (Tasks, Habits, Google Calendar, Gmail, Executive Voice Briefings) "
        "and Multi-Platform API integrations."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Schemas ──────────────────────────────────────────────────────────────────


class ChatHistoryMessage(BaseModel):
    role: str
    content: str


class AgentChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000)
    thread_id: Optional[str] = None
    platform: str = Field(default="web", description="e.g. web, okike-crm, whatsapp, mobile")
    history: list[ChatHistoryMessage] = Field(default_factory=list)


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)


class PlatformEventWebhook(BaseModel):
    source_platform: str = Field(..., description="Name or domain of the OKIKE platform sending the event")
    event_type: str = Field(..., description="e.g. new_lead, urgent_alert, order_created, support_escalation")
    title: str = Field(..., min_length=1, max_length=300)
    notes: Optional[str] = None
    create_priority_task: bool = False
    priority: str = "high"


# ─── Endpoints ────────────────────────────────────────────────────────────────


@app.get("/")
async def root_info() -> dict[str, Any]:
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "http://localhost:8000/docs",
        "health_url": "http://localhost:8000/v1/health",
        "web_dashboard_url": "http://localhost:8080",
    }


@app.get("/v1/health")
async def health_check() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "supabase_configured": bool(settings.SUPABASE_URL and settings.SUPABASE_PUBLISHABLE_KEY),
        "groq_configured": bool(settings.GROQ_API_KEY),
        "groq_model": settings.GROQ_MODEL,
        "gemini_configured": bool(settings.GOOGLE_GENERATIVE_AI_API_KEY),
        "google_oauth_configured": bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/v1/agent/chat")
async def agent_chat(
    req: AgentChatRequest,
    ctx: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    """
    Universal Multi-Platform Coach Ziri Chat & Tool Execution Endpoint.
    Can be called from the React dashboard, mobile apps, or any OKIKE platform via `X-Okike-Key`.
    """
    thread_id = req.thread_id
    history_dicts = [{"role": m.role, "content": m.content} for m in req.history]

    # If a thread_id is supplied (or if we want to load thread history from Supabase)
    if thread_id and not history_dicts:
        try:
            msgs_res = (
                ctx.supabase.table("chat_messages")
                .select("role,parts")
                .eq("thread_id", thread_id)
                .order("created_at", desc=False)
                .limit(20)
                .execute()
            )
            for row in msgs_res.data or []:
                parts = row.get("parts") or []
                text = " ".join(
                    p.get("text", "") for p in parts if isinstance(p, dict) and p.get("type") == "text"
                ).strip()
                if text:
                    history_dicts.append({"role": row.get("role", "user"), "content": text})
        except Exception:
            pass

    # Persist incoming user message if thread_id is provided
    if thread_id:
        try:
            ctx.supabase.table("chat_messages").insert(
                {
                    "thread_id": thread_id,
                    "user_id": ctx.user_id,
                    "role": "user",
                    "parts": [{"type": "text", "text": req.message}],
                }
            ).execute()
        except Exception:
            pass

    try:
        result = run_ziri_agent(ctx, message=req.message, history=history_dicts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Persist assistant response if thread_id is provided
    if thread_id and result.get("reply"):
        try:
            ctx.supabase.table("chat_messages").insert(
                {
                    "thread_id": thread_id,
                    "user_id": ctx.user_id,
                    "role": "assistant",
                    "parts": [{"type": "text", "text": result["reply"]}],
                }
            ).execute()
            ctx.supabase.table("chat_threads").update(
                {"updated_at": datetime.now(timezone.utc).isoformat()}
            ).eq("id", thread_id).execute()
        except Exception:
            pass

    return {
        "ok": True,
        "platform": req.platform,
        "thread_id": thread_id,
        **result,
    }


@app.post("/v1/agent/briefing")
async def executive_briefing(
    ctx: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    """
    Generates a live Executive Voice Briefing across the user's open tasks, calendar, and habits.
    """
    prompt = (
        "Give me a concise 3-sentence executive briefing of my day right now: "
        "check my open/overdue tasks, my upcoming Google Calendar events for today, and my daily habits."
    )
    try:
        result = run_ziri_agent(ctx, message=prompt, history=[])
        return {"ok": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/agent/tts")
async def agent_tts(req: TTSRequest) -> Response:
    """
    Synthesizes Coach Ziri's neural 'Aoede' voice into WAV audio bytes.
    """
    try:
        wav_bytes = await synthesize_ziri_voice(req.text)
        return Response(content=wav_bytes, media_type="audio/wav")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/v1/webhooks/platform-event")
async def ingest_platform_event(
    event: PlatformEventWebhook,
    ctx: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    """
    Cross-Platform Event Receiver for OKIKE Ecosystem.
    Any OKIKE website, CRM, or service can push an event here to log activity
    and optionally create a high-priority task for Coach Ziri to alert you about.
    """
    created_task_id: Optional[str] = None

    if event.create_priority_task:
        res = (
            ctx.supabase.table("tasks")
            .insert(
                {
                    "user_id": ctx.user_id,
                    "title": f"[{event.source_platform}] {event.title}",
                    "notes": event.notes or f"Event type: {event.event_type}",
                    "priority": event.priority if event.priority in ("low", "medium", "high") else "high",
                    "due_at": datetime.now(timezone.utc).isoformat(),
                    "remind_at": datetime.now(timezone.utc).isoformat(),
                    "recurrence": "none",
                }
            )
            .execute()
        )
        if res.data:
            created_task_id = res.data[0].get("id")

    ctx.supabase.table("activity_logs").insert(
        {
            "user_id": ctx.user_id,
            "action": f"platform_event:{event.source_platform}:{event.event_type}",
            "details": {
                "source_platform": event.source_platform,
                "event_type": event.event_type,
                "title": event.title,
                "notes": event.notes,
                "created_task_id": created_task_id,
            },
        }
    ).execute()

    return {
        "ok": True,
        "source_platform": event.source_platform,
        "event_type": event.event_type,
        "created_task_id": created_task_id,
    }

