from uuid import UUID

from fastapi.testclient import TestClient

from backend.app.api.dependencies import get_current_user
from backend.app.core.auth import CurrentUser
from backend.app.core.config import Settings
from backend.app.main import create_app


class FakeAuth:
    async def close(self) -> None:
        return None


class FakeSupabase:
    auth = FakeAuth()


def make_app(monkeypatch):
    async def create_client(settings):
        return FakeSupabase()

    monkeypatch.setattr("backend.app.main.create_supabase_client", create_client)
    return create_app(
        Settings(
            supabase_url="http://localhost:54321",
            supabase_secret_key="test-secret",
        )
    )


def test_health_and_openapi(monkeypatch):
    app = make_app(monkeypatch)
    with TestClient(app) as client:
        response = client.get("/health", headers={"x-request-id": "request-123"})
        schema = client.get("/openapi.json").json()

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["x-request-id"] == "request-123"
    assert "/api/v1/artists" in schema["paths"]
    assert "/api/v1/portfolio" in schema["paths"]
    assert "/api/v1/trades" in schema["paths"]


def test_public_domain_route_returns_standard_not_implemented(monkeypatch):
    app = make_app(monkeypatch)
    with TestClient(app) as client:
        response = client.get("/api/v1/market")

    assert response.status_code == 501
    assert response.json()["code"] == "domain_not_implemented"
    assert response.json()["request_id"] == response.headers["x-request-id"]


def test_protected_route_requires_bearer_token(monkeypatch):
    app = make_app(monkeypatch)
    with TestClient(app) as client:
        response = client.get("/api/v1/portfolio")

    assert response.status_code == 401
    assert response.json()["code"] == "unauthenticated"


def test_authenticated_route_reaches_service_placeholder(monkeypatch):
    app = make_app(monkeypatch)

    async def current_user():
        return CurrentUser(id=UUID("12345678-1234-5678-1234-567812345678"))

    app.dependency_overrides[get_current_user] = current_user
    with TestClient(app) as client:
        response = client.get("/api/v1/portfolio")

    assert response.status_code == 501
    assert response.json()["code"] == "domain_not_implemented"


def test_trade_validation_uses_standard_error_shape(monkeypatch):
    app = make_app(monkeypatch)

    async def current_user():
        return CurrentUser(id=UUID("12345678-1234-5678-1234-567812345678"))

    app.dependency_overrides[get_current_user] = current_user
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/trades",
            json={
                "artist_id": "Not Valid",
                "side": "hold",
                "quantity": 0,
                "request_id": "not-a-uuid",
            },
        )

    body = response.json()
    assert response.status_code == 422
    assert body["code"] == "validation_error"
    assert set(body["field_errors"]) == {
        "body.artist_id",
        "body.side",
        "body.quantity",
        "body.request_id",
    }


def test_invalid_artist_id_is_rejected_before_service(monkeypatch):
    app = make_app(monkeypatch)
    with TestClient(app) as client:
        response = client.get("/api/v1/artists/Not Valid")

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


def test_readiness_reports_supabase_status(monkeypatch):
    app = make_app(monkeypatch)

    class Response:
        def raise_for_status(self):
            return None

    class HttpClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def get(self, url, headers):
            assert url.endswith("/auth/v1/health")
            assert headers == {"apikey": "test-secret"}
            return Response()

    monkeypatch.setattr("backend.app.main.httpx.AsyncClient", lambda **kwargs: HttpClient())
    with TestClient(app) as client:
        response = client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_readiness_hides_dependency_failure_details(monkeypatch):
    app = make_app(monkeypatch)

    class HttpClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def get(self, url, headers):
            import httpx

            raise httpx.ConnectError("secret internal address")

    monkeypatch.setattr("backend.app.main.httpx.AsyncClient", lambda **kwargs: HttpClient())
    with TestClient(app) as client:
        response = client.get("/ready")

    assert response.status_code == 503
    assert response.json()["code"] == "dependency_unavailable"
    assert "secret internal address" not in response.text
