from datetime import date
from unittest.mock import MagicMock, Mock

import pytest
import requests
import responses

from pipelines.last_fm_pipeline import LastfmError, dedupe_by_key, fetch_top_tracks, track_key
import pipelines.last_fm_pipeline as last_fm_pipeline

LASTFM_URL = "http://ws.audioscrobbler.com/2.0/"


def toptracks_payload(tracks):
    return {"toptracks": {"track": tracks}}


# ---------------------------------------------------------------------------
# track_key
# ---------------------------------------------------------------------------

def test_track_key_lowercases_and_strips_trailing_punctuation():
    assert track_key("HUMBLE.") == "humble"
    assert track_key("Humble") == "humble"


def test_track_key_strips_feature_credit():
    assert track_key("Money Trees (feat. Jay Rock)") == "money trees"


def test_track_key_strips_edition_marker():
    assert track_key("Alright - Remastered 2015") == "alright"


def test_track_key_keeps_remix_and_live_markers():
    base = track_key("Song")
    assert track_key("Song (Remix)") != base
    assert track_key("Song (Live)") != base


def test_track_key_folds_accents():
    assert track_key("Café") == track_key("Cafe") == "cafe"


def test_track_key_empty_name_returns_none():
    assert track_key("") is None
    assert track_key(None) is None


def test_track_key_punctuation_only_falls_back_to_original():
    assert track_key("!!!") == "!!!"


# ---------------------------------------------------------------------------
# dedupe_by_key
# ---------------------------------------------------------------------------

def make_track(rank, name, key):
    return {"rank": rank, "name": name, "track_key": key}


def test_dedupe_by_key_keeps_first_of_duplicate_keys():
    tracks = [
        make_track(4, "WHATCHU KNO ABOUT ME (feat. Sexyy Red)", "whatchu kno about me"),
        make_track(6, "WHATCHU KNO ABOUT ME (with Sexyy Red)", "whatchu kno about me"),
    ]

    result = dedupe_by_key(tracks)

    assert len(result) == 1
    assert result[0]["rank"] == 4


def test_dedupe_by_key_drops_none_keys():
    tracks = [make_track(1, "", None), make_track(2, "Real Song", "real song")]

    result = dedupe_by_key(tracks)

    assert result == [tracks[1]]


def test_dedupe_by_key_no_duplicates_passthrough():
    tracks = [make_track(1, "A", "a"), make_track(2, "B", "b")]

    assert dedupe_by_key(tracks) == tracks


# ---------------------------------------------------------------------------
# fetch_top_tracks
# ---------------------------------------------------------------------------

@responses.activate
def test_fetch_top_tracks_success():
    payload = toptracks_payload([
        {"name": "Song A", "listeners": "100", "playcount": "500", "mbid": "mbid-a"},
        {"name": "Song B", "listeners": "50", "playcount": "200", "mbid": ""},
    ])
    responses.add(responses.GET, LASTFM_URL, json=payload, status=200)

    result = fetch_top_tracks("fake-key", "Some Artist")

    assert result == [
        {
            "rank": 1,
            "name": "Song A",
            "track_key": "song a",
            "mbid": "mbid-a",
            "listeners": 100,
            "playcount": 500,
        },
        {
            "rank": 2,
            "name": "Song B",
            "track_key": "song b",
            "mbid": None,
            "listeners": 50,
            "playcount": 200,
        },
    ]


@responses.activate
def test_fetch_top_tracks_single_result_as_dict():
    payload = toptracks_payload({"name": "Solo Song", "listeners": "10", "playcount": "20"})
    responses.add(responses.GET, LASTFM_URL, json=payload, status=200)

    result = fetch_top_tracks("fake-key", "Some Artist")

    assert len(result) == 1
    assert result[0]["name"] == "Solo Song"


@responses.activate
def test_fetch_top_tracks_missing_listeners_and_playcount_stay_none():
    payload = toptracks_payload([{"name": "Song A"}])
    responses.add(responses.GET, LASTFM_URL, json=payload, status=200)

    result = fetch_top_tracks("fake-key", "Some Artist")

    assert result[0]["listeners"] is None
    assert result[0]["playcount"] is None


@responses.activate
def test_fetch_top_tracks_raises_lastfm_error_on_error_body():
    responses.add(
        responses.GET,
        LASTFM_URL,
        json={"error": 6, "message": "The artist you supplied could not be found"},
        status=200,
    )

    with pytest.raises(LastfmError, match="could not be found"):
        fetch_top_tracks("fake-key", "Unknown Artist")


@responses.activate
def test_fetch_top_tracks_error_body_without_message_uses_default():
    responses.add(responses.GET, LASTFM_URL, json={"error": 6}, status=200)

    with pytest.raises(LastfmError, match="unknown error"):
        fetch_top_tracks("fake-key", "Unknown Artist")


@responses.activate
def test_fetch_top_tracks_raises_http_error():
    responses.add(responses.GET, LASTFM_URL, json={"error": "boom"}, status=403)

    with pytest.raises(requests.exceptions.HTTPError):
        fetch_top_tracks("fake-key", "Some Artist")


# ---------------------------------------------------------------------------
# process_artist
# ---------------------------------------------------------------------------

ARTIST_ROW = {"id": 3, "name": "Some Artist"}


def mock_supabase(upsert_data=None):
    supabase = MagicMock()
    supabase.table.return_value.upsert.return_value.execute.return_value.data = (
        upsert_data if upsert_data is not None else [{"id": 1}]
    )
    return supabase


@responses.activate
def test_process_artist_upserts_deduped_rows():
    payload = toptracks_payload([
        {"name": "WHATCHU KNO ABOUT ME (feat. Sexyy Red)", "listeners": "100", "playcount": "500"},
        {"name": "WHATCHU KNO ABOUT ME (with Sexyy Red)", "listeners": "90", "playcount": "400"},
        {"name": "Song C", "listeners": "10", "playcount": "20"},
    ])
    responses.add(responses.GET, LASTFM_URL, json=payload, status=200)
    supabase = mock_supabase()
    today = date(2026, 8, 31)

    last_fm_pipeline.process_artist(supabase, "fake-key", ARTIST_ROW, today)

    assert supabase.table.call_args.args[0] == "lastfm_track_snapshots"

    upsert_call = supabase.table.return_value.upsert.call_args
    rows = upsert_call.args[0]
    assert upsert_call.kwargs == {
        "on_conflict": "artist_id,track_key,date",
        "ignore_duplicates": True,
    }

    # 3 tracks in, 1 dropped as a duplicate -> 2 rows, rank gap preserved
    assert len(rows) == 2
    assert rows[0]["rank"] == 1
    assert rows[0]["track_name"] == "WHATCHU KNO ABOUT ME (feat. Sexyy Red)"
    assert rows[0]["artist_id"] == 3
    assert rows[0]["date"] == "2026-08-31"
    assert rows[1]["rank"] == 3
    assert rows[1]["track_name"] == "Song C"


@responses.activate
def test_process_artist_raises_lastfm_error_when_no_tracks_after_dedupe():
    responses.add(responses.GET, LASTFM_URL, json=toptracks_payload([]), status=200)
    supabase = mock_supabase()

    with pytest.raises(LastfmError, match="no top tracks returned"):
        last_fm_pipeline.process_artist(supabase, "fake-key", ARTIST_ROW, date(2026, 8, 31))

    supabase.table.assert_not_called()


@responses.activate
def test_process_artist_propagates_lastfm_error_from_unknown_artist():
    responses.add(
        responses.GET,
        LASTFM_URL,
        json={"error": 6, "message": "The artist you supplied could not be found"},
        status=200,
    )
    supabase = mock_supabase()

    with pytest.raises(LastfmError, match="could not be found"):
        last_fm_pipeline.process_artist(supabase, "fake-key", ARTIST_ROW, date(2026, 8, 31))

    supabase.table.assert_not_called()


@responses.activate
def test_process_artist_empty_response_data_does_not_raise():
    payload = toptracks_payload([{"name": "Song A", "listeners": "1", "playcount": "1"}])
    responses.add(responses.GET, LASTFM_URL, json=payload, status=200)
    supabase = mock_supabase(upsert_data=[])

    last_fm_pipeline.process_artist(supabase, "fake-key", ARTIST_ROW, date(2026, 8, 31))


# ---------------------------------------------------------------------------
# run_pipeline
# ---------------------------------------------------------------------------

def mock_supabase_with_artist_rows(rows):
    supabase = MagicMock()
    supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = rows
    return supabase


def test_run_pipeline_artist_not_found_skips_without_calling_process_artist(monkeypatch):
    mock_process_artist = Mock()
    monkeypatch.setattr(last_fm_pipeline, "process_artist", mock_process_artist)
    supabase = mock_supabase_with_artist_rows([])

    failures = last_fm_pipeline.run_pipeline(supabase, "fake-key", ["Ghost Artist"])

    assert failures == [
        {"artist": "Ghost Artist", "reason": "no matching row in the artists table"}
    ]
    mock_process_artist.assert_not_called()


def test_run_pipeline_success_reports_no_failures(monkeypatch):
    mock_process_artist = Mock(return_value=None)
    monkeypatch.setattr(last_fm_pipeline, "process_artist", mock_process_artist)
    row = {"id": 1, "name": "Real Artist"}
    supabase = mock_supabase_with_artist_rows([row])

    failures = last_fm_pipeline.run_pipeline(supabase, "fake-key", ["Real Artist"])

    assert failures == []
    mock_process_artist.assert_called_once()
    args = mock_process_artist.call_args.args
    assert args[0] is supabase
    assert args[1] == "fake-key"
    assert args[2] == row


def test_run_pipeline_lastfm_error_reason(monkeypatch):
    monkeypatch.setattr(
        last_fm_pipeline,
        "process_artist",
        Mock(side_effect=LastfmError("could not be found")),
    )
    row = {"id": 1, "name": "Some Artist"}
    supabase = mock_supabase_with_artist_rows([row])

    failures = last_fm_pipeline.run_pipeline(supabase, "fake-key", ["Some Artist"])

    assert failures == [
        {"artist": "Some Artist", "reason": "Last.fm rejected the lookup: could not be found"}
    ]


def test_run_pipeline_http_error_reason_uses_http_prefix(monkeypatch):
    response = Mock(status_code=403)
    error = requests.exceptions.HTTPError(response=response)
    monkeypatch.setattr(last_fm_pipeline, "process_artist", Mock(side_effect=error))
    row = {"id": 1, "name": "Some Artist"}
    supabase = mock_supabase_with_artist_rows([row])

    failures = last_fm_pipeline.run_pipeline(supabase, "fake-key", ["Some Artist"])

    assert failures == [{"artist": "Some Artist", "reason": "HTTP error: HTTP 403"}]


def test_run_pipeline_non_http_request_error_reason_uses_request_prefix(monkeypatch):
    error = requests.exceptions.Timeout()
    monkeypatch.setattr(last_fm_pipeline, "process_artist", Mock(side_effect=error))
    row = {"id": 1, "name": "Some Artist"}
    supabase = mock_supabase_with_artist_rows([row])

    failures = last_fm_pipeline.run_pipeline(supabase, "fake-key", ["Some Artist"])

    assert failures == [{"artist": "Some Artist", "reason": "request failed: Timeout"}]


def test_run_pipeline_generic_exception_reason_includes_type_and_message(monkeypatch):
    monkeypatch.setattr(
        last_fm_pipeline, "process_artist", Mock(side_effect=ValueError("bad row"))
    )
    row = {"id": 1, "name": "Some Artist"}
    supabase = mock_supabase_with_artist_rows([row])

    failures = last_fm_pipeline.run_pipeline(supabase, "fake-key", ["Some Artist"])

    assert failures == [{"artist": "Some Artist", "reason": "ValueError: bad row"}]


def test_run_pipeline_one_failure_does_not_stop_the_run(monkeypatch):
    row = {"id": 1, "name": "Some Artist"}
    mock_process_artist = Mock(side_effect=[ValueError("boom"), None])
    monkeypatch.setattr(last_fm_pipeline, "process_artist", mock_process_artist)
    supabase = mock_supabase_with_artist_rows([row])

    failures = last_fm_pipeline.run_pipeline(supabase, "fake-key", ["Artist A", "Artist B"])

    assert failures == [{"artist": "Artist A", "reason": "ValueError: boom"}]
    assert mock_process_artist.call_count == 2


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def test_main_calls_run_pipeline_with_module_level_dependencies(monkeypatch):
    mock_run_pipeline = Mock()
    monkeypatch.setattr(last_fm_pipeline, "run_pipeline", mock_run_pipeline)

    last_fm_pipeline.main()

    mock_run_pipeline.assert_called_once_with(
        last_fm_pipeline.supabase, last_fm_pipeline.lastfm_api_key, last_fm_pipeline.artists
    )
