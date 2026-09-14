from dataclasses import dataclass
from uuid import UUID

from supabase_auth.errors import AuthError

from backend.app.core.errors import AppError


@dataclass(frozen=True)
class CurrentUser:
    id: UUID


async def verify_access_token(client: object, token: str) -> CurrentUser:
    try:
        response = await client.auth.get_claims(token)
        subject = response.claims.get("sub") if response else None
        return CurrentUser(id=UUID(subject))
    except (AuthError, KeyError, TypeError, ValueError, AttributeError) as exc:
        raise AppError(
            status_code=401,
            code="unauthenticated",
            message="Provide a valid access token.",
        ) from exc
