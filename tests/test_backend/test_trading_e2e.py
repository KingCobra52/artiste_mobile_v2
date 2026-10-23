"""Opt-in end-to-end trading checks against a running API and two test accounts."""

import os
from uuid import uuid4

import httpx
import pytest

REQUIRED_ENV = (
    "TRADING_E2E_SUPABASE_URL",
    "TRADING_E2E_SUPABASE_PUBLISHABLE_KEY",
    "TRADING_E2E_API_URL",
    "TRADING_E2E_USER_A_EMAIL",
    "TRADING_E2E_USER_A_PASSWORD",
    "TRADING_E2E_USER_B_EMAIL",
    "TRADING_E2E_USER_B_PASSWORD",
)


def configured() -> bool:
    return all(os.getenv(name) for name in REQUIRED_ENV)


pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not configured(),
        reason="Set TRADING_E2E_* variables for two dedicated test accounts and running services.",
    ),
]


def _login(client: httpx.Client, email: str, password: str) -> str:
    response = client.post(
        f"{os.environ['TRADING_E2E_SUPABASE_URL'].rstrip('/')}/auth/v1/token?grant_type=password",
        headers={"apikey": os.environ["TRADING_E2E_SUPABASE_PUBLISHABLE_KEY"]},
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def _request(client: httpx.Client, token: str, method: str, path: str, **kwargs):
    response = client.request(
        method,
        f"{os.environ['TRADING_E2E_API_URL'].rstrip('/')}{path}",
        headers={"Authorization": f"Bearer {token}"},
        **kwargs,
    )
    return response


def test_trade_lifecycle_idempotency_and_account_isolation():
    with httpx.Client(timeout=20) as client:
        token_a = _login(
            client,
            os.environ["TRADING_E2E_USER_A_EMAIL"],
            os.environ["TRADING_E2E_USER_A_PASSWORD"],
        )
        token_b = _login(
            client,
            os.environ["TRADING_E2E_USER_B_EMAIL"],
            os.environ["TRADING_E2E_USER_B_PASSWORD"],
        )
        artists_response = _request(client, token_a, "GET", "/api/v1/artists")
        quotes_response = _request(client, token_a, "GET", "/api/v1/market")
        assert artists_response.status_code == quotes_response.status_code == 200
        artists = {artist["id"]: artist for artist in artists_response.json()}
        quote = next(
            (
                item
                for item in quotes_response.json()
                if item["status"] == "fresh"
                and item["priceCents"] is not None
                and item["artistId"] in artists
            ),
            None,
        )
        if quote is None:
            pytest.skip("No fresh quote is available to execute a trade.")

        initial_a = _request(client, token_a, "GET", "/api/v1/portfolio").json()
        initial_b = _request(client, token_b, "GET", "/api/v1/portfolio").json()
        history_before = _request(client, token_a, "GET", "/api/v1/portfolio/history")
        assert history_before.status_code == 200
        history_count = len(history_before.json()["points"])
        request_id = str(uuid4())
        buy = {
            "artistId": quote["artistId"],
            "side": "buy",
            "quantity": 1,
            "requestId": request_id,
        }

        bought = _request(client, token_a, "POST", "/api/v1/trades", json=buy)
        assert bought.status_code == 200, bought.text
        bought_data = bought.json()
        assert bought_data["idempotent"] is False

        retried = _request(client, token_a, "POST", "/api/v1/trades", json=buy)
        assert retried.status_code == 200, retried.text
        assert retried.json()["tradeId"] == bought_data["tradeId"]
        assert retried.json()["idempotent"] is True

        rejected = _request(
            client,
            token_a,
            "POST",
            "/api/v1/trades",
            json={
                "artistId": quote["artistId"],
                "side": "sell",
                "quantity": 1_000_000,
                "requestId": str(uuid4()),
            },
        )
        assert rejected.status_code == 409
        assert rejected.json()["code"] == "insufficient_shares"

        sold = _request(
            client,
            token_a,
            "POST",
            "/api/v1/trades",
            json={
                "artistId": quote["artistId"],
                "side": "sell",
                "quantity": 1,
                "requestId": str(uuid4()),
            },
        )
        assert sold.status_code == 200, sold.text

        same_key_other_user = _request(client, token_b, "POST", "/api/v1/trades", json=buy)
        assert same_key_other_user.status_code == 200, same_key_other_user.text
        assert same_key_other_user.json()["idempotent"] is False
        assert same_key_other_user.json()["tradeId"] != bought_data["tradeId"]

        portfolio_a = _request(client, token_a, "GET", "/api/v1/portfolio").json()
        portfolio_b = _request(client, token_b, "GET", "/api/v1/portfolio").json()
        ids_a = {trade["id"] for trade in portfolio_a["trades"]}
        ids_b = {trade["id"] for trade in portfolio_b["trades"]}
        assert bought_data["tradeId"] in ids_a
        assert bought_data["tradeId"] not in ids_b
        assert same_key_other_user.json()["tradeId"] in ids_b
        assert portfolio_b["summary"]["cashCents"] == (
            initial_b["summary"]["cashCents"] - same_key_other_user.json()["totalCents"]
        )
        initial_a_quantity = sum(
            holding["quantity"]
            for holding in initial_a["holdings"]
            if holding["artist"]["id"] == quote["artistId"]
        )
        final_a_quantity = sum(
            holding["quantity"]
            for holding in portfolio_a["holdings"]
            if holding["artist"]["id"] == quote["artistId"]
        )
        assert initial_a_quantity == final_a_quantity

        history_after = _request(client, token_a, "GET", "/api/v1/portfolio/history")
        assert history_after.status_code == 200
        assert len(history_after.json()["points"]) >= history_count + 3
