import base64
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Optional
from urllib.parse import quote
import httpx
from app.auth import AuthContext
from app.config import settings


def get_google_access_token_sync(ctx: AuthContext) -> str:
    """Exchanges the user's stored Google refresh token in Supabase for a live access token."""
    res = (
        ctx.supabase.table("user_integrations")
        .select("google_refresh_token")
        .eq("user_id", ctx.user_id)
        .maybeSingle()
        .execute()
    )
    data = res.data if res else None
    refresh_token = data.get("google_refresh_token") if isinstance(data, dict) else None
    if not refresh_token:
        raise RuntimeError(
            "Google account not connected. Please connect Google Workspace in Settings."
        )

    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise RuntimeError("Server missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.")

    with httpx.Client(timeout=12.0) as client:
        token_res = client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )
    if token_res.status_code != 200:
        raise RuntimeError(
            "Failed to refresh Google access token. Please reconnect Google Workspace in Settings."
        )
    return token_res.json()["access_token"]


def build_user_tools(ctx: AuthContext) -> list[Callable[..., Any]]:
    """
    Builds the suite of Python tools bound to the authenticated user's context
    for Google GenAI automatic function calling.
    """

    def list_tasks(status: str = "todo") -> dict[str, Any]:
        """List the user's tasks. status can be 'todo', 'done', or 'all'."""
        try:
            q = (
                ctx.supabase.table("tasks")
                .select("id,title,due_at,remind_at,priority,status,notes,created_at")
                .eq("user_id", ctx.user_id)
            )
            if status in ("todo", "done"):
                q = q.eq("status", status)
            res = q.order("created_at", desc=True).execute()
            return {"tasks": res.data or []}
        except Exception as e:
            return {"error": str(e)}

    def create_task(
        title: str,
        priority: str = "medium",
        notes: Optional[str] = None,
        due_at: Optional[str] = None,
        remind_at: Optional[str] = None,
        recurrence: str = "none",
    ) -> dict[str, Any]:
        """Create a new task for the user. due_at and remind_at should be ISO-8601 datetime strings if provided."""
        try:
            payload: dict[str, Any] = {
                "user_id": ctx.user_id,
                "title": title,
                "priority": priority if priority in ("low", "medium", "high") else "medium",
                "recurrence": recurrence if recurrence in ("none", "daily", "weekly") else "none",
            }
            if notes:
                payload["notes"] = notes
            if due_at:
                payload["due_at"] = due_at
            if remind_at:
                payload["remind_at"] = remind_at

            res = ctx.supabase.table("tasks").insert(payload).execute()
            return {"task": (res.data or [None])[0]}
        except Exception as e:
            return {"error": str(e)}

    def complete_task(task_id: str) -> dict[str, Any]:
        """Mark an existing task as done by its UUID task_id."""
        try:
            now_iso = datetime.now(timezone.utc).isoformat()
            res = (
                ctx.supabase.table("tasks")
                .update({"status": "done", "completed_at": now_iso})
                .eq("id", task_id)
                .eq("user_id", ctx.user_id)
                .execute()
            )
            return {"task": (res.data or [None])[0]}
        except Exception as e:
            return {"error": str(e)}

    def update_task(
        task_id: str,
        title: Optional[str] = None,
        notes: Optional[str] = None,
        due_at: Optional[str] = None,
        remind_at: Optional[str] = None,
        priority: Optional[str] = None,
    ) -> dict[str, Any]:
        """Update fields on an existing task by its UUID task_id."""
        try:
            patch: dict[str, Any] = {}
            if title is not None:
                patch["title"] = title
            if notes is not None:
                patch["notes"] = notes
            if due_at is not None:
                patch["due_at"] = due_at
            if remind_at is not None:
                patch["remind_at"] = remind_at
            if priority in ("low", "medium", "high"):
                patch["priority"] = priority

            res = (
                ctx.supabase.table("tasks")
                .update(patch)
                .eq("id", task_id)
                .eq("user_id", ctx.user_id)
                .execute()
            )
            return {"task": (res.data or [None])[0]}
        except Exception as e:
            return {"error": str(e)}

    def delete_task(task_id: str) -> dict[str, Any]:
        """Delete a task by its UUID task_id."""
        try:
            ctx.supabase.table("tasks").delete().eq("id", task_id).eq(
                "user_id", ctx.user_id
            ).execute()
            return {"ok": True}
        except Exception as e:
            return {"error": str(e)}

    def list_habits() -> dict[str, Any]:
        """List all tracked daily habits and their completion logs for the user."""
        try:
            res = (
                ctx.supabase.table("habits")
                .select("id,title,notes,created_at,habit_logs(completed_date)")
                .eq("user_id", ctx.user_id)
                .order("created_at", desc=False)
                .execute()
            )
            return {"habits": res.data or []}
        except Exception as e:
            return {"error": str(e)}

    def create_habit(title: str, notes: Optional[str] = None) -> dict[str, Any]:
        """Create a new daily habit for the user."""
        try:
            res = (
                ctx.supabase.table("habits")
                .insert({"user_id": ctx.user_id, "title": title, "notes": notes})
                .execute()
            )
            return {"habit": (res.data or [None])[0]}
        except Exception as e:
            return {"error": str(e)}

    def log_habit(habit_id: str, date_yyyy_mm_dd: str, completed: bool = True) -> dict[str, Any]:
        """Mark a habit as completed or uncompleted on a specific YYYY-MM-DD date."""
        try:
            if completed:
                ctx.supabase.table("habit_logs").insert(
                    {
                        "habit_id": habit_id,
                        "user_id": ctx.user_id,
                        "completed_date": date_yyyy_mm_dd,
                    }
                ).execute()
            else:
                ctx.supabase.table("habit_logs").delete().eq("habit_id", habit_id).eq(
                    "user_id", ctx.user_id
                ).eq("completed_date", date_yyyy_mm_dd).execute()
            return {"ok": True, "habit_id": habit_id, "date": date_yyyy_mm_dd, "completed": completed}
        except Exception as e:
            return {"error": str(e)}

    def list_goals() -> dict[str, Any]:
        """List all strategic goals and their progress percentage for the user."""
        try:
            res = (
                ctx.supabase.table("goals")
                .select("*")
                .eq("user_id", ctx.user_id)
                .order("created_at", desc=True)
                .execute()
            )
            return {"goals": res.data or []}
        except Exception as e:
            return {"error": str(e)}

    def create_goal(
        title: str,
        description: Optional[str] = None,
        target_date: Optional[str] = None,
        progress: int = 0,
    ) -> dict[str, Any]:
        """Create a new strategic goal for the user."""
        try:
            clamped = max(0, min(100, progress))
            res = (
                ctx.supabase.table("goals")
                .insert(
                    {
                        "user_id": ctx.user_id,
                        "title": title,
                        "description": description,
                        "target_date": target_date,
                        "progress": clamped,
                        "status": "completed" if clamped >= 100 else "active",
                    }
                )
                .execute()
            )
            return {"goal": (res.data or [None])[0]}
        except Exception as e:
            return {"error": str(e)}

    def update_goal_progress(goal_id: str, progress: int) -> dict[str, Any]:
        """Update the progress percentage (0 to 100) of an existing goal by its UUID goal_id."""
        try:
            clamped = max(0, min(100, progress))
            res = (
                ctx.supabase.table("goals")
                .update(
                    {
                        "progress": clamped,
                        "status": "completed" if clamped >= 100 else "active",
                    }
                )
                .eq("id", goal_id)
                .eq("user_id", ctx.user_id)
                .execute()
            )
            return {"goal": (res.data or [None])[0]}
        except Exception as e:
            return {"error": str(e)}

    def list_calendar_events(hours_ahead: int = 72, max_results: int = 10) -> dict[str, Any]:
        """List upcoming Google Calendar events from the user's primary calendar."""
        try:
            token = get_google_access_token_sync(ctx)
            now = datetime.now(timezone.utc)
            time_min = now.isoformat()
            time_max = (now + timedelta(hours=max(1, min(hours_ahead, 720)))).isoformat()
            url = (
                "https://www.googleapis.com/calendar/v3/calendars/primary/events"
                f"?singleEvents=true&orderBy=startTime&maxResults={max(1, min(max_results, 25))}"
                f"&timeMin={quote(time_min)}&timeMax={quote(time_max)}"
            )
            with httpx.Client(timeout=12.0) as client:
                r = client.get(url, headers={"Authorization": f"Bearer {token}"})
            if r.status_code != 200:
                return {"error": f"Calendar error {r.status_code}"}
            items = r.json().get("items", [])
            return {
                "events": [
                    {
                        "id": e.get("id"),
                        "summary": e.get("summary"),
                        "start": (e.get("start") or {}).get("dateTime")
                        or (e.get("start") or {}).get("date"),
                        "end": (e.get("end") or {}).get("dateTime")
                        or (e.get("end") or {}).get("date"),
                        "location": e.get("location"),
                    }
                    for e in items
                ]
            }
        except Exception as e:
            return {"error": str(e)}

    def create_calendar_event(
        summary: str,
        start_iso: str,
        end_iso: str,
        description: Optional[str] = None,
        location: Optional[str] = None,
    ) -> dict[str, Any]:
        """Create a Google Calendar event on the user's primary calendar."""
        try:
            token = get_google_access_token_sync(ctx)
            body: dict[str, Any] = {
                "summary": summary,
                "start": {"dateTime": start_iso},
                "end": {"dateTime": end_iso},
            }
            if description:
                body["description"] = description
            if location:
                body["location"] = location

            with httpx.Client(timeout=12.0) as client:
                r = client.post(
                    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                    headers={"Authorization": f"Bearer {token}"},
                    json=body,
                )
            if r.status_code not in (200, 201):
                return {"error": f"Calendar error {r.status_code}: {r.text}"}
            data = r.json()
            return {"ok": True, "eventId": data.get("id"), "htmlLink": data.get("htmlLink")}
        except Exception as e:
            return {"error": str(e)}

    def search_emails(query: str = "is:unread", max_results: int = 5) -> dict[str, Any]:
        """Search the user's Gmail inbox and return email IDs, senders, subjects, and snippets."""
        try:
            token = get_google_access_token_sync(ctx)
            base = "https://gmail.googleapis.com/gmail/v1/users/me"
            headers = {"Authorization": f"Bearer {token}"}
            with httpx.Client(timeout=15.0) as client:
                list_r = client.get(
                    f"{base}/messages?maxResults={max(1, min(max_results, 15))}&q={quote(query)}",
                    headers=headers,
                )
                if list_r.status_code != 200:
                    return {"error": f"Gmail error {list_r.status_code}"}
                messages = list_r.json().get("messages", [])
                emails = []
                for m in messages[:max_results]:
                    mr = client.get(
                        f"{base}/messages/{m['id']}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date",
                        headers=headers,
                    )
                    if mr.status_code != 200:
                        continue
                    d = mr.json()
                    hdrs = {
                        h["name"].lower(): h["value"]
                        for h in (d.get("payload") or {}).get("headers", [])
                    }
                    emails.append(
                        {
                            "id": m["id"],
                            "threadId": m.get("threadId"),
                            "from": hdrs.get("from"),
                            "subject": hdrs.get("subject"),
                            "date": hdrs.get("date"),
                            "snippet": d.get("snippet"),
                        }
                    )
                return {"emails": emails}
        except Exception as e:
            return {"error": str(e)}

    def send_email(to: str, subject: str, body: str) -> dict[str, Any]:
        """Send an email from the user's connected Gmail account."""
        try:
            token = get_google_access_token_sync(ctx)
            rfc = "\r\n".join(
                [
                    f"To: {to}",
                    f"Subject: {subject}",
                    'Content-Type: text/plain; charset="UTF-8"',
                    "",
                    body,
                ]
            )
            raw = base64.urlsafe_b64encode(rfc.encode("utf-8")).decode("ascii").rstrip("=")
            with httpx.Client(timeout=12.0) as client:
                r = client.post(
                    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                    headers={"Authorization": f"Bearer {token}"},
                    json={"raw": raw},
                )
            if r.status_code != 200:
                return {"error": f"Gmail send error {r.status_code}: {r.text}"}
            return {"ok": True}
        except Exception as e:
            return {"error": str(e)}

    def web_search(query: str, limit: int = 5) -> dict[str, Any]:
        """Search the live web for current news, facts, or company information."""
        if not settings.FIRECRAWL_API_KEY:
            return {"error": "FIRECRAWL_API_KEY not configured"}
        try:
            with httpx.Client(timeout=15.0) as client:
                r = client.post(
                    "https://api.firecrawl.dev/v2/search",
                    headers={"Authorization": f"Bearer {settings.FIRECRAWL_API_KEY}"},
                    json={"query": query, "limit": max(1, min(limit, 8))},
                )
            if r.status_code != 200:
                return {"error": f"Search failed: {r.status_code}"}
            data = r.json().get("data", {})
            items = data.get("web", data) if isinstance(data, dict) else data
            return {
                "results": [
                    {
                        "title": item.get("title"),
                        "url": item.get("url"),
                        "snippet": item.get("description"),
                    }
                    for item in (items or [])[:limit]
                ]
            }
        except Exception as e:
            return {"error": str(e)}

    return [
        list_tasks,
        create_task,
        complete_task,
        update_task,
        delete_task,
        list_habits,
        create_habit,
        log_habit,
        list_goals,
        create_goal,
        update_goal_progress,
        list_calendar_events,
        create_calendar_event,
        search_emails,
        send_email,
        web_search,
    ]

