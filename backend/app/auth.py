from dataclasses import dataclass
from typing import Optional
import httpx
from fastapi import Header, HTTPException, status
from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions
from app.config import settings


@dataclass
class AuthContext:
    user_id: str
    email: Optional[str]
    supabase: Client
    is_platform_key: bool = False


async def get_auth_context(
    authorization: Optional[str] = Header(default=None),
    x_okike_key: Optional[str] = Header(default=None),
    x_okike_user_id: Optional[str] = Header(default=None),
) -> AuthContext:
    """
    Dual-mode Enterprise Auth:
    1. Platform API Key (`X-Okike-Key`): Allows other OKIKE websites, bots, and servers
       to call Coach Ziri on behalf of a user (`X-Okike-User-Id` or `OKIKE_OWNER_USER_ID`).
    2. Supabase Bearer JWT (`Authorization: Bearer <token>`): Standard user session auth
       from the Coach Ziri web dashboard or mobile app.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_PUBLISHABLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase credentials not configured on server.",
        )

    # Mode 1: Platform API Key (Server-to-Server / External OKIKE Platforms)
    if x_okike_key and settings.OKIKE_PLATFORM_API_KEY:
        if x_okike_key == settings.OKIKE_PLATFORM_API_KEY:
            target_user = x_okike_user_id or settings.DEFAULT_OWNER_USER_ID
            if not target_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="X-Okike-User-Id header or OKIKE_OWNER_USER_ID env is required when using X-Okike-Key.",
                )
            service_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_PUBLISHABLE_KEY
            sb = create_client(settings.SUPABASE_URL, service_key)
            return AuthContext(
                user_id=target_user,
                email=None,
                supabase=sb,
                is_platform_key=True,
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid X-Okike-Key.",
        )

    # Mode 2: Supabase User Bearer JWT
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization Bearer token or X-Okike-Key header.",
        )

    token = authorization.split(" ", 1)[1].strip()

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{settings.SUPABASE_URL}/auth/v1/user",
            headers={
                "apikey": settings.SUPABASE_PUBLISHABLE_KEY,
                "Authorization": f"Bearer {token}",
            },
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Supabase session token.",
        )

    user_data = resp.json()
    user_id = user_data.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to resolve user ID from token.",
        )

    sb = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_PUBLISHABLE_KEY,
        options=ClientOptions(headers={"Authorization": f"Bearer {token}"}),
    )

    return AuthContext(
        user_id=user_id,
        email=user_data.get("email"),
        supabase=sb,
        is_platform_key=False,
    )

