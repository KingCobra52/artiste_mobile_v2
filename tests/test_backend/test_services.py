from datetime import date, datetime, timezone

import pytest

from backend.app.core.errors import AppError
from backend.app.schemas.artist import Artist
from backend.app.schemas.market import MarketQuote, QuoteStatus
from backend.app.schemas.trade import TradeDraft, TradeResult, TradeSide
from backend.app.services.market import MarketService
from backend.app.services.pricing import calculate_quote
from backend.app.services.trading import TradingService


def test_gap_adjusted_change_is_capped_per_elapsed_day():
    quote = calculate_quote(
        [(date(2026, 10, 18), 100), (date(2026, 10, 22), 200)],
        [],
        now=datetime(2026, 10, 23, 12, tzinfo=timezone.utc),
    )

    assert quote["price_cents"] == 1216
    assert quote["change_percent"] == 5.0
    assert quote["status"] == "fresh"
    assert quote["as_of"] == datetime(2026, 10, 22, tzinfo=timezone.utc)


def test_blend_weights_lastfm_and_youtube_equally():
    quote = calculate_quote(
        [(date(2026, 10, 12), 100), (date(2026, 10, 22), 110)],
        [(date(2026, 10, 20), 100), (date(2026, 10, 22), 80)],
        now=datetime(2026, 10, 23, 12, tzinfo=timezone.utc),
    )

    assert quote["price_cents"] == 1004
    assert quote["change_percent"] == -2.0


def test_one_available_fresh_signal_is_used_and_renormalized():
    quote = calculate_quote(
        [],
        [(date(2026, 10, 21), 100), (date(2026, 10, 22), 101)],
        now=datetime(2026, 10, 23, 12, tzinfo=timezone.utc),
    )

    assert quote["price_cents"] == 1010
    assert quote["change_percent"] == 1.0
    assert quote["status"] == "fresh"


def test_zero_baselines_are_ignored_until_a_positive_value_exists():
    quote = calculate_quote(
        [(date(2026, 10, 20), 0), (date(2026, 10, 21), 10)],
        [],
        now=datetime(2026, 10, 22, 12, tzinfo=timezone.utc),
    )

    assert quote["price_cents"] == 1000
    assert quote["change_percent"] == 0


def test_old_quotes_are_stale_and_no_history_is_unavailable():
    stale = calculate_quote(
        [(date(2026, 10, 20), 100), (date(2026, 10, 21), 110)],
        [],
        now=datetime(2026, 10, 23, 1, tzinfo=timezone.utc),
    )
    missing = calculate_quote([], [], now=datetime(2026, 10, 23, tzinfo=timezone.utc))

    assert stale["status"] == "stale"
    assert missing == {
        "price_cents": None,
        "change_percent": None,
        "as_of": None,
        "status": "unavailable",
    }


class FakeArtists:
    def __init__(self, artists):
        self.artists = artists

    async def list(self):
        return self.artists

    async def get(self, artist_id):
        return next((artist for artist in self.artists if artist.id == artist_id), None)


class FakeSnapshots:
    def __init__(self, quotes):
        self.quotes = quotes

    async def list_quotes(self):
        return self.quotes


@pytest.mark.anyio
async def test_market_returns_unavailable_quotes_for_artists_without_history():
    artist = Artist(id="1", name="Example", symbol="E", genre="Music")
    service = MarketService(FakeArtists([artist]), FakeSnapshots([]))

    quotes = await service.list_quotes()

    assert quotes == [MarketQuote(artist_id="1", status=QuoteStatus.UNAVAILABLE)]


@pytest.mark.anyio
async def test_trading_service_rejects_stale_quotes_before_repository_write():
    artist = Artist(id="1", name="Example", symbol="E", genre="Music")
    market = MarketService(
        FakeArtists([artist]),
        FakeSnapshots([MarketQuote(artist_id="1", price_cents=1000, status="stale")]),
    )

    class NoTrades:
        async def find_trade(self, *args):
            return None

        async def submit_trade(self, *args):
            pytest.fail("stale quote must not reach the trade repository")

    service = TradingService(NoTrades(), market)
    draft = TradeDraft(
        artist_id="1",
        side=TradeSide.BUY,
        quantity=1,
        request_id="123e4567-e89b-12d3-a456-426614174000",
    )

    with pytest.raises(AppError, match="not current") as error:
        await service.submit("12345678-1234-5678-1234-567812345678", draft)

    assert error.value.status_code == 409


@pytest.mark.anyio
async def test_idempotent_retry_is_returned_even_if_market_quote_is_now_stale():
    artist = Artist(id="1", name="Example", symbol="E", genre="Music")
    market = MarketService(
        FakeArtists([artist]),
        FakeSnapshots([MarketQuote(artist_id="1", price_cents=1000, status="stale")]),
    )
    result = TradeResult(
        ok=True,
        code="accepted",
        message="Trade was already processed.",
        trade_id=7,
        execution_price_cents=1000,
        total_cents=1000,
        cash_cents=999000,
        idempotent=True,
    )

    class ExistingTrade:
        async def get(self, *args):
            return object()

        async def record_snapshot(self, *args, **kwargs):
            return None

        async def find_trade(self, *args):
            return result

        async def submit_trade(self, *args):
            pytest.fail("idempotent retry must not create another trade")

    draft = TradeDraft(
        artist_id="1",
        side=TradeSide.BUY,
        quantity=1,
        request_id="123e4567-e89b-12d3-a456-426614174000",
    )

    assert await TradingService(ExistingTrade(), market).submit(
        "12345678-1234-5678-1234-567812345678", draft
    ) == result


@pytest.mark.anyio
async def test_successful_trade_records_a_portfolio_snapshot():
    artist = Artist(id="1", name="Example", symbol="E", genre="Music")
    market = MarketService(
        FakeArtists([artist]),
        FakeSnapshots([MarketQuote(artist_id="1", price_cents=1000, status="fresh")]),
    )
    result = TradeResult(
        ok=True,
        code="accepted",
        message="Paper trade completed.",
        trade_id=42,
        execution_price_cents=1000,
        total_cents=1000,
        cash_cents=999000,
    )

    class RecordingPortfolio:
        snapshot_args = None

        async def find_trade(self, *args):
            return None

        async def submit_trade(self, *args):
            return result

        async def get(self, *args):
            return object()

        async def record_snapshot(self, *args, **kwargs):
            self.snapshot_args = (args, kwargs)

    repository = RecordingPortfolio()
    draft = TradeDraft(
        artist_id="1",
        side=TradeSide.BUY,
        quantity=1,
        request_id="123e4567-e89b-12d3-a456-426614174000",
    )

    assert await TradingService(repository, market).submit(
        "12345678-1234-5678-1234-567812345678", draft
    ) == result
    assert repository.snapshot_args[0][2] == "trade"
    assert repository.snapshot_args[1] == {"trade_id": 42}
