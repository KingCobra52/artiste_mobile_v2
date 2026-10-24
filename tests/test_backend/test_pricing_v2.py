from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from backend.app.repositories.snapshots import SupabaseSnapshotsRepository, all_rows
from backend.app.schemas.artist import Artist
from backend.app.schemas.market import MarketQuote
from backend.app.services.market import MarketService
from backend.app.services.pricing import (
    audience_quote,
    calculate_quote,
    curve_order,
    marginal_price,
)

NOW = datetime(2026, 10, 23, 12, tzinfo=timezone.utc)


def observation(day, tracks=None, subscribers=None, artist_id=1):
    return {
        "artist_id": artist_id,
        "snapshot_date": day,
        "lastfm_tracks": tracks,
        "youtube_subscribers": subscribers,
    }


def test_top_track_membership_cannot_manufacture_growth():
    quote = audience_quote(
        [
            observation("2026-10-21", {"same": 1000, "gone": 99999}),
            observation("2026-10-22", {"same": 1010, "new": 900000}),
        ],
        now=NOW,
    )
    assert quote["price_cents"] == 1010
    assert quote["sources"]["lastfm"]["matchedTracks"] == 1


def test_disjoint_cohort_is_not_treated_as_growth():
    quote = audience_quote(
        [observation("2026-10-21", {"old": 10}), observation("2026-10-22", {"new": 100000})],
        now=NOW,
    )
    assert quote["price_cents"] is None
    assert quote["observation_count"] == 0


def test_future_rows_cannot_change_price_status_or_provenance():
    rows = [
        observation("2026-10-21", {"same": 1000}, 1000),
        observation("2026-10-22", {"same": 1010}, 1020),
    ]
    expected = audience_quote(rows, now=NOW)
    assert (
        audience_quote(rows + [observation("2026-10-24", {"same": 999999999}, 999999999)], now=NOW)
        == expected
    )
    assert (
        audience_quote([observation("2026-10-24", {"same": 99}, 999)], now=NOW)["status"]
        == "unavailable"
    )


def test_future_legacy_series_cannot_establish_baseline():
    assert calculate_quote([(date(2026, 10, 24), 999)], [], now=NOW)["price_cents"] is None


def test_geometric_growth_uses_elapsed_days_without_overstatement():
    result = calculate_quote([(date(2026, 10, 12), 1000), (date(2026, 10, 22), 1100)], [], now=NOW)
    assert result["price_cents"] == 1100
    assert result["change_percent"] == pytest.approx(0.9577)


@pytest.mark.parametrize("inventory", [-1000000, -10000, 0, 10000, 1000000])
def test_inventory_premium_is_bounded(inventory):
    assert 800 <= marginal_price(1000, inventory) <= 1200


@pytest.mark.parametrize("quantity", [1, 5, 99, 10000, 1000000])
def test_round_trip_cannot_mint_cash(quantity):
    bought = curve_order(1000, 0, quantity, "buy")
    sold = curve_order(1000, quantity, quantity, "sell")
    assert bought["total_cents"] >= sold["total_cents"]
    assert bought["price_after_cents"] > 0


class Query:
    def __init__(self, rows):
        self.rows, self.offset, self.end, self.calls = rows, 0, 0, []

    def range(self, start, end):
        self.offset, self.end = start, end
        self.calls.append((start, end))
        return self

    def select(self, *args):
        return self

    async def execute(self):
        return SimpleNamespace(data=self.rows[self.offset : self.end + 1])


@pytest.mark.anyio
async def test_pagination_returns_more_than_database_row_limit():
    query = Query(list(range(1201)))
    assert len(await all_rows(query)) == 1201
    assert query.calls == [(0, 499), (500, 999), (1000, 1499)]


@pytest.mark.anyio
async def test_repository_retains_artists_after_first_thousand_rows():
    rows = [
        observation((date(2026, 7, 1) + timedelta(days=day)).isoformat(), None, 1000 + day, artist)
        for artist in range(1, 26)
        for day in range(50)
    ]

    class Client:
        def rpc(self, name):
            assert name == "get_pricing_observations"
            return Query(rows)

        def table(self, name):
            return Query([])

    assert len(await SupabaseSnapshotsRepository(Client()).list_quotes()) == 25


@pytest.mark.anyio
async def test_only_complete_active_fresh_artists_are_discoverable():
    good = Artist(
        id="1",
        name="Artist",
        symbol="A",
        genre="Hip-hop",
        biography="Biography",
        music_context="Context",
        listening_url="https://youtube.com/example",
    )

    class Artists:
        async def list(self):
            return [
                good,
                good.model_copy(update={"id": "2", "active": False}),
                good.model_copy(update={"id": "3", "biography": ""}),
                good.model_copy(update={"id": "4"}),
            ]

    class Quotes:
        async def list_quotes(self):
            return [
                MarketQuote(
                    artist_id=str(i),
                    price_cents=1000,
                    status="stale" if i == 4 else "fresh",
                    observation_count=2,
                    quote_version="1",
                )
                for i in range(1, 5)
            ]

    assert [a.id for a in await MarketService(Artists(), Quotes()).list_artists()] == ["1"]


@pytest.mark.anyio
async def test_missing_artist_handles_empty_sdk_response():
    from backend.app.repositories.artists import SupabaseArtistsRepository

    class MissingQuery:
        def select(self, *args):
            return self

        def eq(self, *args):
            return self

        def maybe_single(self):
            return self

        async def execute(self):
            return None

    client = SimpleNamespace(table=lambda name: MissingQuery())
    assert await SupabaseArtistsRepository(client).get("999999") is None
    assert await SupabaseArtistsRepository(client).get("999999999999999999") is None


def test_single_source_observations_do_not_dilute_a_measured_source():
    quote = audience_quote(
        [
            observation("2026-10-21", None, 1000),
            observation("2026-10-22", {"new": 500}, 1020),
        ],
        now=NOW,
    )
    assert quote["price_cents"] == 1020
    assert set(quote["sources"]) == {"youtube"}


def test_separate_single_observations_cannot_make_a_supported_quote():
    quote = audience_quote(
        [
            observation("2026-10-21", {"new": 500}),
            observation("2026-10-22", None, 1020),
        ],
        now=NOW,
    )
    assert quote["status"] == "unavailable"
    assert quote["observation_count"] == 0


def test_fresh_source_remains_usable_when_other_source_is_stale():
    quote = audience_quote(
        [
            observation("2026-10-18", {"same": 1000}),
            observation("2026-10-19", {"same": 1010}),
            observation("2026-10-21", None, 1000),
            observation("2026-10-22", None, 1020),
        ],
        now=NOW,
    )
    assert quote["status"] == "fresh"
    assert quote["price_cents"] == 1020
    assert not quote["sources"]["lastfm"]["included"]
    assert quote["sources"]["youtube"]["included"]


def test_source_baselines_are_independent_of_other_sources_growth():
    quote = calculate_quote(
        [(date(2026, 10, 18), 1000), (date(2026, 10, 19), 1050)],
        [(date(2026, 10, 20), 5000), (date(2026, 10, 21), 5050)],
        now=NOW,
    )
    assert quote["price_cents"] == 1030
