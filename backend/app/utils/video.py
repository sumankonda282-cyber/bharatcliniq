import time
import logging
import httpx
from app.core.config import settings

log = logging.getLogger(__name__)
_DAILY = "https://api.daily.co/v1"


def _headers() -> dict:
    return {"Authorization": f"Bearer {settings.DAILY_API_KEY}", "Content-Type": "application/json"}


async def create_daily_room(room_name: str, exp_minutes: int = 120, exp_at: int | None = None) -> dict | None:
    """
    Create a private Daily.co room.
    exp_at (unix epoch) takes precedence over exp_minutes — used to anchor
    room expiry to the appointment slot end instead of creation time.
    Returns the room dict (includes 'url') or None if Daily is unconfigured.
    Free tier: 10,000 participant-minutes/month.
    """
    if not settings.DAILY_API_KEY:
        return None
    exp = exp_at if exp_at else int(time.time()) + exp_minutes * 60
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{_DAILY}/rooms",
                headers=_headers(),
                json={
                    "name": room_name,
                    "privacy": "private",
                    "properties": {
                        "exp": exp,
                        "eject_at_room_exp": True,
                        "enable_screenshare": False,
                        "enable_chat": True,
                        "enable_knocking": True,
                        "max_participants": 4,
                    },
                },
                timeout=10.0,
            )
            r.raise_for_status()
            return r.json()
    except Exception as e:
        log.error(f"[video] create_room {room_name!r} failed: {e}")
        return None


async def get_or_create_room(room_name: str, exp_minutes: int = 120, exp_at: int | None = None) -> dict | None:
    """Get existing room or create it. Avoids duplicate rooms on repeated joins."""
    if not settings.DAILY_API_KEY:
        return None
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{_DAILY}/rooms/{room_name}", headers=_headers(), timeout=10.0)
            if r.status_code == 200:
                return r.json()
    except Exception:
        pass
    return await create_daily_room(room_name, exp_minutes, exp_at=exp_at)


async def update_room_exp(room_name: str, exp_at: int) -> bool:
    """Extend/shrink an existing room's expiry (used for doctor-approved rejoin windows)."""
    if not settings.DAILY_API_KEY:
        return False
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{_DAILY}/rooms/{room_name}",
                headers=_headers(),
                json={"properties": {"exp": exp_at, "eject_at_room_exp": True}},
                timeout=10.0,
            )
            r.raise_for_status()
            return True
    except Exception as e:
        log.error(f"[video] update_room_exp {room_name!r} failed: {e}")
        return False


async def delete_room(room_name: str) -> bool:
    """Delete a room — the link dies instantly. Recreating with the same name revives the same link."""
    if not settings.DAILY_API_KEY:
        return False
    try:
        async with httpx.AsyncClient() as client:
            r = await client.delete(f"{_DAILY}/rooms/{room_name}", headers=_headers(), timeout=10.0)
            return r.status_code in (200, 404)
    except Exception as e:
        log.error(f"[video] delete_room {room_name!r} failed: {e}")
        return False


async def create_meeting_token(room_name: str, is_owner: bool = False, exp_minutes: int = 120, exp_at: int | None = None) -> str | None:
    """
    Create a short-lived participant token for a Daily.co room.
    Doctors get is_owner=True (can mute/remove); patients get is_owner=False.
    exp_at (unix epoch) anchors token expiry to the visit window when provided.
    """
    if not settings.DAILY_API_KEY:
        return None
    exp = exp_at if exp_at else int(time.time()) + exp_minutes * 60
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{_DAILY}/meeting-tokens",
                headers=_headers(),
                json={
                    "properties": {
                        "room_name": room_name,
                        "is_owner": is_owner,
                        "exp": exp,
                    }
                },
                timeout=10.0,
            )
            r.raise_for_status()
            return r.json().get("token")
    except Exception as e:
        log.error(f"[video] create_token {room_name!r} failed: {e}")
        return None


def jitsi_fallback_url(room_name: str) -> str:
    """Public Jitsi fallback when Daily.co is unconfigured (dev/demo only)."""
    return f"https://meet.jit.si/{room_name}"
