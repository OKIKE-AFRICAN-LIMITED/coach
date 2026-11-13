import base64
import inspect
import json
import struct
from datetime import datetime, timezone
from typing import Any, Callable, Optional, Union, get_args, get_origin, get_type_hints
import httpx
from app.auth import AuthContext
from app.config import settings
from app.tools import build_user_tools


def _python_type_to_json_schema(tp: Any) -> dict[str, Any]:
    """Maps basic Python type annotations (including Optional[T]) to JSON Schema."""
    origin = get_origin(tp)
    if origin is Union:
        non_none = [a for a in get_args(tp) if a is not type(None)]
        if len(non_none) == 1:
            return _python_type_to_json_schema(non_none[0])
    if tp is bool:
        return {"type": "boolean"}
    if tp is int:
        return {"type": "integer"}
    if tp is float:
        return {"type": "number"}
    if tp is list or origin is list:
        return {"type": "array", "items": {"type": "string"}}
    if tp is dict or origin is dict:
        return {"type": "object"}
    return {"type": "string"}


def _callable_to_openai_tool(fn: Callable[..., Any]) -> dict[str, Any]:
    """Converts a typed Python tool function into an OpenAI-compatible tool schema."""
    sig = inspect.signature(fn)
    try:
        hints = get_type_hints(fn)
    except Exception:
        hints = {}

    properties: dict[str, Any] = {}
    required: list[str] = []
    for param_name, param in sig.parameters.items():
        tp = hints.get(param_name, str)
        properties[param_name] = _python_type_to_json_schema(tp)
        if param.default is inspect.Parameter.empty:
            required.append(param_name)

    return {
        "type": "function",
        "function": {
            "name": fn.__name__,
            "description": (inspect.getdoc(fn) or fn.__name__).strip(),
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required,
            },
        },
    }


def build_system_prompt(ctx: AuthContext) -> str:
    """Builds Coach Ziri's executive system prompt with live task telemetry from Supabase."""
    now = datetime.now(timezone.utc)
    open_count = 0
    overdue_count = 0
    due_today_count = 0

    try:
        res = (
            ctx.supabase.table("tasks")
            .select("due_at,created_at")
            .eq("user_id", ctx.user_id)
            .eq("status", "todo")
            .execute()
        )
        rows = res.data or []
        open_count = len(rows)
        start_of_today = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        end_of_today = start_of_today.replace(hour=23, minute=59, second=59)

        for r in rows:
            due_str = r.get("due_at")
            if due_str:
                try:
                    dt = datetime.fromisoformat(due_str.replace("Z", "+00:00"))
                    if dt < start_of_today:
                        overdue_count += 1
                    elif start_of_today <= dt <= end_of_today:
                        due_today_count += 1
                except Exception:
                    pass
    except Exception:
        pass

    memories_block = ""
    try:
        mem_res = (
            ctx.supabase.table("user_memories")
            .select("id,category,content")
            .eq("user_id", ctx.user_id)
            .order("updated_at", desc=True)
            .limit(25)
            .execute()
        )
        mem_rows = mem_res.data or []
        if mem_rows:
            lines = [f"- [{m.get('category', 'general')}] {m.get('content', '')}" for m in mem_rows]
            memories_block = "\n\nLONG-TERM USER MEMORY (persisted across all chats):\n" + "\n".join(lines)
    except Exception:
        pass

    tone = (
        "The user has overdue items — be gently firm and specific about priorities."
        if overdue_count >= 3
        else "The user is on track — be encouraging and decisive."
    )

    return (
        "CRITICAL IDENTITY DIRECTIVE: Your name is strictly Coach Ziri, the OKIKE Core Intelligence "
        "and Executive AI Agent. Never refer to yourself as any other name. Speak in the first person, "
        "keep replies conversational, executive, and concise (most under 3 sentences) since they may be "
        f"spoken aloud. {tone}\n\n"
        "OKIKE INSTITUTIONAL KNOWLEDGE:\n"
        "- OKIKE Enterprises is an institution that births other institutions across 3 core branches:\n"
        "  1) 01 / Startups (OKIKE Ventures & AI Labs): Early-stage venture architecture, rapid 2-3 week MVP engineering, and proprietary AI tools like Coach Ziri (https://coach-ziri.okikeenterprises.com).\n"
        "  2) 02 / Businesses (OKIKE Studio — https://studio.okikeenterprises.com): Brand identity systems, web platforms, mobile apps, and custom internal software. Direct client inquiries to https://studio.okikeenterprises.com/enquiry.\n"
        "  3) 03 / Students (OKIKE Academy — /learn & /enroll): 8-12 week engineering cohorts in Fullstack Web, UI/UX, Mobile, Python/Data Science, and Cybersecurity, plus the interactive student portal (/dashboard).\n"
        "- Flagship Computing Synergy Summit Bootcamp (August 1, 2026): Admission is FREE for CS/IT students with a valid University Registration Number containing 'CSC' (case-insensitive, one-time use), and ₦5,000 (via Korapay) for non-CS students.\n\n"
        f"Today (UTC) is {now.isoformat()}.\n"
        f"Open tasks: {open_count} total. Overdue: {overdue_count}. Due today: {due_today_count}.{memories_block}\n\n"
        "You have live tools for tasks (including remind_at alarms), daily habits, Google Calendar, "
        "Gmail, and web search. Use them proactively whenever asked."
    )


def run_ziri_agent(
    ctx: AuthContext,
    message: str,
    history: Optional[list[dict[str, str]]] = None,
) -> dict[str, Any]:
    """
    Executes a turn with Coach Ziri using Groq's OpenAI-compatible API and automatic Python tool calling.
    """
    if not settings.GROQ_API_KEY:
        raise RuntimeError("Missing GROQ_API_KEY in environment.")

    tools = build_user_tools(ctx)
    tool_map: dict[str, Callable[..., Any]] = {fn.__name__: fn for fn in tools}
    tool_schemas = [_callable_to_openai_tool(fn) for fn in tools]
    system_instruction = build_system_prompt(ctx)

    messages: list[dict[str, Any]] = [{"role": "system", "content": system_instruction}]
    for item in history or []:
        role = "assistant" if item.get("role") in ("assistant", "model") else "user"
        text = item.get("text") or item.get("content") or ""
        if text:
            messages.append({"role": role, "content": text})
    messages.append({"role": "user", "content": message})

    reply_text = ""
    with httpx.Client(timeout=45.0) as client:
        for _ in range(6):
            res = client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.GROQ_MODEL,
                    "messages": messages,
                    "tools": tool_schemas,
                    "tool_choice": "auto",
                    "temperature": 0.4,
                },
            )
            if res.status_code != 200:
                raise RuntimeError(f"Groq API error {res.status_code}: {res.text}")

            data = res.json()
            choice = (data.get("choices") or [{}])[0]
            assistant_msg = choice.get("message") or {}
            tool_calls = assistant_msg.get("tool_calls") or []

            if not tool_calls:
                reply_text = (assistant_msg.get("content") or "").strip()
                break

            messages.append(
                {
                    "role": "assistant",
                    "content": assistant_msg.get("content") or "",
                    "tool_calls": tool_calls,
                }
            )

            for tc in tool_calls:
                tc_id = tc.get("id", "")
                fn_info = tc.get("function") or {}
                fn_name = fn_info.get("name", "")
                raw_args = fn_info.get("arguments") or "{}"
                fn = tool_map.get(fn_name)
                if not fn:
                    result: Any = {"error": f"Unknown tool: {fn_name}"}
                else:
                    try:
                        parsed_args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                        result = fn(**(parsed_args or {}))
                    except Exception as e:
                        result = {"error": str(e)}

                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc_id,
                        "content": json.dumps(result, default=str),
                    }
                )

    return {
        "reply": reply_text,
        "model": settings.GROQ_MODEL,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def pcm_to_wav(pcm_bytes: bytes, sample_rate: int = 24000) -> bytes:
    """Wraps raw 16-bit mono PCM bytes from Gemini TTS in a standard 44-byte WAV header."""
    num_channels = 1
    bits_per_sample = 16
    byte_rate = sample_rate * num_channels * (bits_per_sample // 8)
    block_align = num_channels * (bits_per_sample // 8)
    data_len = len(pcm_bytes)

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + data_len,
        b"WAVE",
        b"fmt ",
        16,
        1,
        num_channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b"data",
        data_len,
    )
    return header + pcm_bytes


async def synthesize_ziri_voice(text: str) -> bytes:
    """Synthesizes Coach Ziri's neural 'Aoede' voice into WAV audio bytes via Gemini TTS."""
    if not settings.GOOGLE_GENERATIVE_AI_API_KEY:
        raise RuntimeError("Missing GOOGLE_GENERATIVE_AI_API_KEY")

    models = ["gemini-2.5-flash-preview-tts", "gemini-2.0-flash-exp"]
    clean_text = text.strip()[:800]

    async with httpx.AsyncClient(timeout=20.0) as client:
        for model in models:
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{model}:generateContent?key={settings.GOOGLE_GENERATIVE_AI_API_KEY}"
            )
            res = await client.post(
                url,
                json={
                    "contents": [{"parts": [{"text": clean_text}]}],
                    "generationConfig": {
                        "responseModalities": ["AUDIO"],
                        "speechConfig": {
                            "voiceConfig": {
                                "prebuiltVoiceConfig": {"voiceName": "Aoede"}
                            }
                        },
                    },
                },
            )
            if res.status_code != 200:
                continue
            data = res.json()
            candidates = data.get("candidates") or []
            if not candidates:
                continue
            parts = ((candidates[0].get("content") or {}).get("parts")) or []
            if not parts:
                continue
            b64 = (parts[0].get("inlineData") or {}).get("data")
            if b64:
                return pcm_to_wav(base64.b64decode(b64))

    raise RuntimeError("Could not synthesize audio from Gemini TTS models.")

