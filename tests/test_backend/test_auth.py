from types import SimpleNamespace
from uuid import UUID

import pytest
from supabase_auth.errors import AuthInvalidJwtError

from backend.app.core.auth import verify_access_token
from backend.app.core.errors import AppError


class ClaimsResponse:
    def __init__(self, claims):
        self.claims = claims


class FakeAuth:
    def __init__(self, result=None, error=None, user=None):
        self.result = result
        self.error = error
        self.user = user

    async def get_claims(self, token):
        if self.error:
            raise self.error
        return self.result

    async def get_user(self, token):
        if self.error:
            raise self.error
        return SimpleNamespace(user=self.user)


class FakeClient:
    def __init__(self, auth):
        self.auth = auth


@pytest.mark.anyio
async def test_verify_access_token_returns_typed_user():
    user_id = UUID("12345678-1234-5678-1234-567812345678")
    client = FakeClient(
        FakeAuth(
            ClaimsResponse({"sub": str(user_id)}),
            user=SimpleNamespace(
                id=user_id,
                email_confirmed_at="2026-01-01",
                phone_confirmed_at=None,
                is_anonymous=False,
            ),
        )
    )

    user = await verify_access_token(client, "valid-token")

    assert user.id == user_id


@pytest.mark.anyio
async def test_verify_access_token_accepts_sdk_claims_dictionary():
    user_id = UUID("12345678-1234-5678-1234-567812345678")
    client = FakeClient(
        FakeAuth(
            {"claims": {"sub": str(user_id)}},
            user=SimpleNamespace(
                id=user_id,
                email_confirmed_at="2026-01-01",
                phone_confirmed_at=None,
                is_anonymous=False,
            ),
        )
    )

    user = await verify_access_token(client, "valid-token")

    assert user.id == user_id


@pytest.mark.anyio
@pytest.mark.parametrize(
    "confirmed,anonymous",
    [(False, False), (True, True)],
)
async def test_verify_access_token_rejects_unverified_accounts(confirmed, anonymous):
    user_id = UUID("12345678-1234-5678-1234-567812345678")
    client = FakeClient(
        FakeAuth(
            ClaimsResponse({"sub": str(user_id)}),
            user=SimpleNamespace(
                id=user_id,
                email_confirmed_at="2026-01-01" if confirmed else None,
                phone_confirmed_at=None,
                is_anonymous=anonymous,
            ),
        )
    )

    with pytest.raises(AppError) as caught:
        await verify_access_token(client, "valid-token")

    assert caught.value.status_code == 403
    assert caught.value.code == "account_unverified"


@pytest.mark.anyio
async def test_verify_access_token_rejects_phone_only_accounts():
    user_id = UUID("12345678-1234-5678-1234-567812345678")
    client = FakeClient(
        FakeAuth(
            ClaimsResponse({"sub": str(user_id)}),
            user=SimpleNamespace(
                id=user_id,
                email_confirmed_at=None,
                phone_confirmed_at="2026-01-01",
                is_anonymous=False,
            ),
        )
    )

    with pytest.raises(AppError) as caught:
        await verify_access_token(client, "valid-token")

    assert caught.value.status_code == 403
    assert caught.value.code == "account_unverified"


@pytest.mark.anyio
@pytest.mark.parametrize(
    "result,error",
    [
        (None, None),
        (ClaimsResponse({}), None),
        (ClaimsResponse({"sub": "invalid"}), None),
        (None, AuthInvalidJwtError("invalid")),
    ],
)
async def test_verify_access_token_rejects_invalid_claims(result, error):
    client = FakeClient(FakeAuth(result, error))

    with pytest.raises(AppError) as caught:
        await verify_access_token(client, "secret-token")

    assert caught.value.status_code == 401
    assert caught.value.code == "unauthenticated"
    assert "secret-token" not in str(caught.value)
