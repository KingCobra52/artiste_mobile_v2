import logging
from dataclasses import dataclass
from uuid import UUID

from supabase_auth.errors import AuthError

from backend.app.core.errors import AppError

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CurrentUser:
    id: UUID


async def verify_access_token(client: object, token: str) -> CurrentUser:
    try:
        response = await client.auth.get_claims(token)
        claims = (
            response.get("claims", response)
            if isinstance(response, dict)
            else response.claims
            if response
            else None
        )
        subject = claims.get("sub") if isinstance(claims, dict) else None
        user_id = UUID(subject)
        auth_response = await client.auth.get_user(token)
        user = getattr(auth_response, "user", None)
        if user is None or str(user.id) != str(user_id):
            raise ValueError("Authenticated user does not match token")
        if getattr(user, "is_anonymous", False) or not getattr(
            user, "email_confirmed_at", None
        ):
            raise AppError(
                status_code=403,
                code="account_unverified",
                message="Verify your account before continuing.",
            )
        return CurrentUser(id=user_id)
    except (AuthError, KeyError, TypeError, ValueError, AttributeError) as exc:
        logger.info("Access token verification failed (%s)", type(exc).__name__)
        raise AppError(
            status_code=401,
            code="unauthenticated",
            message="Provide a valid access token.",
        ) from exc
