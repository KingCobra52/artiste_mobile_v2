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

        preview = _request(client, token_a, "POST", "/api/v1/trades/preview", json=buy)
        assert preview.status_code == 200, preview.text
        assert not preview.json()["shadow"], "Enable execution only in the dedicated test database."
        buy["quoteVersion"] = preview.json()["quoteVersion"]
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
                "quoteVersion": str(int(buy["quoteVersion"]) + 1),
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
                "quoteVersion": str(int(buy["quoteVersion"]) + 1),
                "requestId": str(uuid4()),
            },
        )
        assert sold.status_code == 200, sold.text

        preview_b = _request(client, token_b, "POST", "/api/v1/trades/preview", json=buy)
        buy["quoteVersion"] = preview_b.json()["quoteVersion"]
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
        assert len(history_after.json()["points"]) >= history_count + 2


def test_concurrent_orders_require_current_version_and_cannot_overspend():
    from concurrent.futures import ThreadPoolExecutor

    with httpx.Client(timeout=20) as client:
        token = _login(
            client,
            os.environ["TRADING_E2E_USER_A_EMAIL"],
            os.environ["TRADING_E2E_USER_A_PASSWORD"],
        )
        before = _request(client, token, "GET", "/api/v1/portfolio").json()["summary"]["cashCents"]
        quote = next(
            row
            for row in _request(client, token, "GET", "/api/v1/market").json()
            if row["artistId"] == "4"
        )
        drafts = [
            {
                "artistId": "4",
                "side": "buy",
                "quantity": 1,
                "requestId": str(uuid4()),
                "quoteVersion": quote["quoteVersion"],
            }
            for _ in range(2)
        ]
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(
                pool.map(
                    lambda draft: _request(client, token, "POST", "/api/v1/trades", json=draft),
                    drafts,
                )
            )
        assert sorted(response.status_code for response in responses) == [200, 409]
        accepted = next(response.json() for response in responses if response.status_code == 200)
        after = _request(client, token, "GET", "/api/v1/portfolio").json()["summary"]["cashCents"]
        assert after == before - accepted["totalCents"]
        quotes = {
            row["artistId"]: row for row in _request(client, token, "GET", "/api/v1/market").json()
        }
        drafts = [
            {
                "artistId": artist,
                "side": "buy",
                "quantity": 600,
                "requestId": str(uuid4()),
                "quoteVersion": quotes[artist]["quoteVersion"],
            }
            for artist in ("4", "16")
        ]
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(
                pool.map(
                    lambda draft: _request(client, token, "POST", "/api/v1/trades", json=draft),
                    drafts,
                )
            )
        assert sorted(response.status_code for response in responses) == [200, 409]
        assert (
            _request(client, token, "GET", "/api/v1/portfolio").json()["summary"]["cashCents"] >= 0
        )


def test_onboarding_progress_is_owned_by_verified_account():
    with httpx.Client(timeout=20) as client:
        tokens = [
            _login(
                client,
                os.environ[f"TRADING_E2E_USER_{label}_EMAIL"],
                os.environ[f"TRADING_E2E_USER_{label}_PASSWORD"],
            )
            for label in ("A", "B")
        ]
        before = [_request(client, token, "GET", "/api/v1/onboarding").json() for token in tokens]
        progress = {"version": 1, "step": 1, "completed": False}
        response = _request(client, tokens[0], "PATCH", "/api/v1/onboarding", json=progress)
        assert response.status_code == 200
        assert _request(client, tokens[0], "GET", "/api/v1/onboarding").json() == progress
        assert _request(client, tokens[1], "GET", "/api/v1/onboarding").json() == before[1]
        forged = {**progress, "user_id": str(uuid4())}
        assert (
            _request(client, tokens[0], "PATCH", "/api/v1/onboarding", json=forged).status_code
            == 422
        )
        assert _request(client, "invalid", "GET", "/api/v1/onboarding").status_code == 401
        for token, state in zip(tokens, before, strict=True):
            if state["version"] == 1:
                assert (
                    _request(client, token, "PATCH", "/api/v1/onboarding", json=state).status_code
                    == 200
                )
