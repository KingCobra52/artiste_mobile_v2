"""Create dedicated local-only fixtures. Never uses the hosted project or browser secrets."""

import json
import os
import secrets
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

from pipelines.portfolio_snapshots import publish_anchors
from supabase import create_client

result = subprocess.run(
    ["./node_modules/.bin/supabase", "status", "--output", "json"],
    capture_output=True,
    text=True,
    check=True,
)
settings = json.JSONDecoder().raw_decode(result.stdout[result.stdout.index("{") :])[0]
url = settings["API_URL"]
if url not in ("http://127.0.0.1:54321", "http://localhost:54321"):
    raise RuntimeError("Test fixtures require the local Supabase stack")
client = create_client(url, settings["SERVICE_ROLE_KEY"])
subprocess.run(
    [
        "docker",
        "exec",
        "-i",
        "supabase_db_artiste_mobile",
        "psql",
        "-U",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
    ],
    input=Path("supabase/seed.sql").read_text(),
    text=True,
    check=True,
    capture_output=True,
)
credentials = []
users = client.auth.admin.list_users()
for label in ("a", "b"):
    email = f"artiste-web-{label}@example.com"
    password = secrets.token_urlsafe(24)
    existing = next((user for user in users if user.email == email), None)
    if existing:
        user = client.auth.admin.update_user_by_id(
            existing.id, {"password": password, "email_confirm": True}
        ).user
    else:
        user = client.auth.admin.create_user(
            {"email": email, "password": password, "email_confirm": True}
        ).user
    credentials.append({"email": email, "password": password, "id": user.id})
now = datetime.now(timezone.utc)
for artist_id in (4, 16, 17):
    for offset in range(3):
        day = (now - timedelta(days=2 - offset)).date().isoformat()
        client.table("youtube_snapshots").upsert(
            {"artist_id": artist_id, "date": day, "subscribers": 100000 + offset * 1000},
            on_conflict="artist_id,date",
        ).execute()
        client.table("lastfm_track_snapshots").upsert(
            {
                "artist_id": artist_id,
                "date": day,
                "track_key": "local-fixture",
                "track_name": "Local test observation",
                "playcount": 10000 + offset * 100,
            },
            on_conflict="artist_id,track_key,date",
        ).execute()
publish_anchors(client)
# Exercise a basic stale artist page and a searchable artist without a quote.
client.rpc(
    "publish_artist_anchor",
    {
        "p_artist_id": 2,
        "p_raw": 1000,
        "p_as_of": (now - timedelta(hours=49)).isoformat(),
        "p_sources": {},
        "p_initial": 1000,
    },
).execute()
for account in credentials:
    positions = (
        client.table("paper_positions")
        .select("artist_id")
        .eq("user_id", account["id"])
        .execute()
        .data
    )
    if not positions:
        state = (
            client.table("artist_market_state")
            .select("version")
            .eq("artist_id", 4)
            .single()
            .execute()
            .data
        )
        client.table("pricing_controls").update({"enabled": True}).eq("id", True).execute()
        client.rpc(
            "execute_market_trade",
            {
                "p_user_id": account["id"],
                "p_artist_id": 4,
                "p_side": "buy",
                "p_quantity": 5,
                "p_request_id": __import__("uuid").uuid4().hex,
                "p_quote_version": str(state["version"]),
            },
        ).execute()
        client.table("paper_positions").insert(
            {
                "user_id": account["id"],
                "artist_id": 1,
                "quantity": 2,
                "average_cost_cents": 1000,
                "cost_basis_cents": 2000,
                "last_purchased_at": now.isoformat(),
            }
        ).execute()
        profile = (
            client.table("profiles")
            .select("cash_cents")
            .eq("id", account["id"])
            .single()
            .execute()
            .data
        )
        client.table("profiles").update({"cash_cents": profile["cash_cents"] - 2000}).eq(
            "id", account["id"]
        ).execute()
    client.rpc(
        "capture_portfolio_v2",
        {"p_user_id": account["id"], "p_source": "quote_refresh", "p_trade_id": None},
    ).execute()
# Enable only the disposable local fixture database, never the hosted engine.
client.table("pricing_controls").update({"enabled": True}).eq("id", True).execute()
path = Path("/tmp/artiste-web-test-env.json")
config = {
    "NEXT_PUBLIC_SUPABASE_URL": url,
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": settings["ANON_KEY"],
    "NEXT_PUBLIC_SITE_URL": "http://127.0.0.1:3000",
    "ARTISTE_API_URL": "http://127.0.0.1:8000",
    "SUPABASE_URL": url,
    "SUPABASE_SECRET_KEY": settings["SERVICE_ROLE_KEY"],
    "PLAYWRIGHT_TEST_EMAIL": credentials[0]["email"],
    "PLAYWRIGHT_TEST_PASSWORD": credentials[0]["password"],
    "TRADING_E2E_SUPABASE_URL": url,
    "TRADING_E2E_SUPABASE_PUBLISHABLE_KEY": settings["ANON_KEY"],
    "TRADING_E2E_API_URL": "http://127.0.0.1:8000",
    "TRADING_E2E_USER_A_EMAIL": credentials[0]["email"],
    "TRADING_E2E_USER_A_PASSWORD": credentials[0]["password"],
    "TRADING_E2E_USER_B_EMAIL": credentials[1]["email"],
    "TRADING_E2E_USER_B_PASSWORD": credentials[1]["password"],
}
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, "w") as output:
    json.dump(config, output)
print(
    "Prepared two local accounts and three supported artists. "
    "Test configuration is in a private temporary file."
)
