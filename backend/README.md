# OKIKE Core Intelligence Engine (Python + FastAPI)

This directory contains the standalone **Python FastAPI** backend that powers **Coach Ziri** across your web dashboard and all external **OKIKE** platforms.

## 1. Quick Start (using `uv` or `pip`)

From the project root (`e:\websites\okikes-coach`):

```powershell
cd backend
uv venv
uv pip install -r requirements.txt
uv run uvicorn app.main:app --reload --port 8000
```

Once running, open **http://localhost:8000/docs** for the interactive Swagger UI.

## 2. Authentication (2 Modes)

1. **Web / Mobile User Session (`Authorization: Bearer <supabase_jwt>`)**:
   Automatically verifies the user's Supabase session token and enforces row-level ownership.
2. **OKIKE Multi-Platform API Key (`X-Okike-Key`)**:
   Set `OKIKE_PLATFORM_API_KEY` and `OKIKE_OWNER_USER_ID` in your `.env`. Any other OKIKE website, CRM, or bot can call the API using:
   ```http
   X-Okike-Key: your_secret_key
   X-Okike-User-Id: your_supabase_user_uuid
   ```

## 3. Core Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/v1/health` | Health and credentials readiness check |
| `POST` | `/v1/agent/chat` | Chat with Coach Ziri + execute tools (Tasks, Habits, Google Calendar, Gmail, Web Search) |
| `POST` | `/v1/agent/briefing` | Generate a live 3-sentence Executive Voice Briefing |
| `POST` | `/v1/agent/tts` | Synthesize Coach Ziri's neural `Aoede` voice (`audio/wav`) |
| `POST` | `/v1/webhooks/platform-event` | Push events from any OKIKE website/app into `activity_logs` and auto-create priority tasks |

