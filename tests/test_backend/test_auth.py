from uuid import UUID

import pytest
from supabase_auth.errors import AuthInvalidJwtError

from backend.app.core.auth import verify_access_token
from backend.app.core.errors import AppError


class ClaimsResponse:
    def __init__(self, claims):
        self.claims = claims


class FakeAuth:
    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error

    async def get_claims(self, token):
        if self.error:
            raise self.error
        return self.result


class FakeClient:
    def __init__(self, auth):
        self.auth = auth


@pytest.mark.anyio
async def test_verify_access_token_returns_typed_user():
    user_id = UUID("12345678-1234-5678-1234-567812345678")
    client = FakeClient(FakeAuth(ClaimsResponse({"sub": str(user_id)})))

    user = await verify_access_token(client, "valid-token")

    assert user.id == user_id


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
