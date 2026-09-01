from datetime import date
from unittest.mock import MagicMock, Mock

from pipelines.yt_pipeline import fetch_channel_information, recent_uploads_data, recent_videos_stats
import pipelines.yt_pipeline as yt_pipeline
import responses
import requests
import pytest

CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels"
PLAYLIST_ITEMS_URL = "https://www.googleapis.com/youtube/v3/playlistItems"
VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"

CHANNEL_PAYLOAD = {
    "items": [
        {
            "id": "UC123",
            "snippet": {"title": "Test Artist"},
            "statistics": {
                "subscriberCount": "1000",
                "viewCount": "50000",
                "videoCount": "42",
            },
            "contentDetails": {
                "relatedPlaylists": {"uploads": "UUplaylist123"}
            },
        }
    ]
}


#writing test for fetch_channel_information
@responses.activate
def test_fetch_channel_information():
    responses.add(
        responses.GET,
        CHANNELS_URL,
        json=CHANNEL_PAYLOAD,
        status=200,
    )

    result = fetch_channel_information("fake-key", channel_id="UC123")

    assert result == {
        "channel_id": "UC123",
        "channel_title": "Test Artist",
        "subscriber_count": 1000,
        "view_count": 50000,
        "video_count": 42,
        "videos_playlist": "UUplaylist123",
    }

    # confirms the real params-building logic ran, not just the mocked response
    sent_url = responses.calls[0].request.url
    assert "id=UC123" in sent_url
    assert "key=fake-key" in sent_url


@responses.activate
def test_fetch_channel_information_by_handle():
    responses.add(
        responses.GET,
        CHANNELS_URL,
        json=CHANNEL_PAYLOAD,
        status=200,
    )

    fetch_channel_information("fake-key", handle="testartist")

    sent_url = responses.calls[0].request.url
    assert "forHandle=%40testartist" in sent_url


@responses.activate
def test_fetch_channel_information_hidden_subscriber_count():
    payload = {
        "items": [
            {
                "id": "UC123",
                "snippet": {"title": "Test Artist"},
                "statistics": {
                    "hiddenSubscriberCount": True,
                    "subscriberCount": "1000",
                    "viewCount": "50000",
                    "videoCount": "42",
                },
                "contentDetails": {"relatedPlaylists": {"uploads": "UUplaylist123"}},
            }
        ]
    }
    responses.add(responses.GET, CHANNELS_URL, json=payload, status=200)

    result = fetch_channel_information("fake-key", channel_id="UC123")

    assert result["subscriber_count"] is None


def test_fetch_channel_information_requires_channel_id_or_handle():
    with pytest.raises(ValueError):
        fetch_channel_information("fake-key")


@responses.activate
def test_fetch_channel_information_raises_on_http_error():
    responses.add(
        responses.GET,
        CHANNELS_URL,
        json={"error": "quota exceeded"},
        status=403,
    )

    with pytest.raises(requests.exceptions.HTTPError):
        fetch_channel_information("fake-key", channel_id="UC123")


# ---------------------------------------------------------------------------
# recent_uploads_data
# ---------------------------------------------------------------------------

def playlist_items_payload(video_ids):
    return {"items": [{"contentDetails": {"videoId": vid}} for vid in video_ids]}


@responses.activate
def test_recent_uploads_data_returns_video_ids_in_order():
    responses.add(
        responses.GET,
        PLAYLIST_ITEMS_URL,
        json=playlist_items_payload(["vid1", "vid2", "vid3"]),
        status=200,
    )

    result = recent_uploads_data("UUplaylist123", "fake-key")

    assert result == ["vid1", "vid2", "vid3"]

    sent_url = responses.calls[0].request.url
    assert "playlistId=UUplaylist123" in sent_url
    assert "maxResults=50" in sent_url


@responses.activate
def test_recent_uploads_data_empty_items_list():
    responses.add(responses.GET, PLAYLIST_ITEMS_URL, json={"items": []}, status=200)

    assert recent_uploads_data("UUplaylist123", "fake-key") == []


@responses.activate
def test_recent_uploads_data_missing_items_key():
    responses.add(responses.GET, PLAYLIST_ITEMS_URL, json={}, status=200)

    assert recent_uploads_data("UUplaylist123", "fake-key") == []


@responses.activate
def test_recent_uploads_data_raises_on_http_error():
    responses.add(responses.GET, PLAYLIST_ITEMS_URL, json={"error": "not found"}, status=404)

    with pytest.raises(requests.exceptions.HTTPError):
        recent_uploads_data("UUplaylist123", "fake-key")


# ---------------------------------------------------------------------------
# recent_videos_stats
# ---------------------------------------------------------------------------

def videos_stats_payload(stats_by_id):
    return {
        "items": [
            {"id": video_id, "statistics": stats}
            for video_id, stats in stats_by_id.items()
        ]
    }


@responses.activate
def test_recent_videos_stats_batches_into_one_request():
    responses.add(
        responses.GET,
        PLAYLIST_ITEMS_URL,
        json=playlist_items_payload(["vid1", "vid2", "vid3"]),
        status=200,
    )
    responses.add(
        responses.GET,
        VIDEOS_URL,
        json=videos_stats_payload({
            "vid1": {"viewCount": "100", "likeCount": "10", "commentCount": "1"},
            "vid2": {"viewCount": "200", "likeCount": "20", "commentCount": "2"},
            "vid3": {"viewCount": "300", "likeCount": "30", "commentCount": "3"},
        }),
        status=200,
    )

    result = recent_videos_stats("UUplaylist123", "fake-key")

    assert result == {
        "vid1": [100, 10, 1],
        "vid2": [200, 20, 2],
        "vid3": [300, 30, 3],
    }

    # exactly one call to the videos endpoint, with all three ids comma-joined
    videos_call = responses.calls[1]
    assert "id=vid1%2Cvid2%2Cvid3" in videos_call.request.url


@responses.activate
def test_recent_videos_stats_no_videos_skips_videos_call():
    responses.add(responses.GET, PLAYLIST_ITEMS_URL, json={"items": []}, status=200)

    result = recent_videos_stats("UUplaylist123", "fake-key")

    assert result == {}
    # only the playlistItems call happened, videos endpoint never hit
    assert len(responses.calls) == 1


@responses.activate
def test_recent_videos_stats_missing_statistics_defaults_to_zero():
    responses.add(
        responses.GET,
        PLAYLIST_ITEMS_URL,
        json=playlist_items_payload(["vid1"]),
        status=200,
    )
    responses.add(
        responses.GET,
        VIDEOS_URL,
        json={"items": [{"id": "vid1"}]},
        status=200,
    )

    result = recent_videos_stats("UUplaylist123", "fake-key")

    assert result == {"vid1": [0, 0, 0]}


@responses.activate
def test_recent_videos_stats_raises_on_http_error():
    responses.add(
        responses.GET,
        PLAYLIST_ITEMS_URL,
        json=playlist_items_payload(["vid1"]),
        status=200,
    )
    responses.add(responses.GET, VIDEOS_URL, json={"error": "quota exceeded"}, status=403)

    with pytest.raises(requests.exceptions.HTTPError):
        recent_videos_stats("UUplaylist123", "fake-key")


# ---------------------------------------------------------------------------
# process_artist
# ---------------------------------------------------------------------------

ARTIST_ROW = {"id": 7, "youtube_handle": "testartist", "youtube_channel_id": "UC123"}


def mock_supabase():
    supabase = MagicMock()
    supabase.table.return_value.insert.return_value.execute.return_value.data = [{"id": 1}]
    return supabase


@responses.activate
def test_process_artist_inserts_snapshot_and_video_rows():
    responses.add(responses.GET, CHANNELS_URL, json=CHANNEL_PAYLOAD, status=200)
    responses.add(
        responses.GET,
        PLAYLIST_ITEMS_URL,
        json=playlist_items_payload(["vid1"]),
        status=200,
    )
    responses.add(
        responses.GET,
        VIDEOS_URL,
        json=videos_stats_payload({"vid1": {"viewCount": "5", "likeCount": "1", "commentCount": "0"}}),
        status=200,
    )
    supabase = mock_supabase()
    today = date(2026, 8, 31)

    yt_pipeline.process_artist(supabase, "fake-key", ARTIST_ROW, today)

    table_calls = [call.args[0] for call in supabase.table.call_args_list]
    assert table_calls == ["youtube_snapshots", "recent_youtube_video_snapshots"]

    insert_calls = supabase.table.return_value.insert.call_args_list
    snapshot_payload = insert_calls[0].args[0]
    assert snapshot_payload == {"artist_id": 7, "subscribers": 1000, "total_views": 50000}

    video_payload = insert_calls[1].args[0]
    assert video_payload == {
        "artist_id": 7,
        "video_id": "vid1",
        "view_count": 5,
        "like_count": 1,
        "comment_count": 0,
        "date": "2026-08-31",
    }


@responses.activate
def test_process_artist_no_recent_videos_only_inserts_snapshot():
    responses.add(responses.GET, CHANNELS_URL, json=CHANNEL_PAYLOAD, status=200)
    responses.add(responses.GET, PLAYLIST_ITEMS_URL, json={"items": []}, status=200)
    supabase = mock_supabase()

    yt_pipeline.process_artist(supabase, "fake-key", ARTIST_ROW, date(2026, 8, 31))

    assert supabase.table.call_count == 1
    assert supabase.table.call_args.args[0] == "youtube_snapshots"


@responses.activate
def test_process_artist_hidden_subscriber_count_inserted_as_none():
    payload = {
        "items": [
            {
                "id": "UC123",
                "snippet": {"title": "Test Artist"},
                "statistics": {
                    "hiddenSubscriberCount": True,
                    "subscriberCount": "1000",
                    "viewCount": "50000",
                    "videoCount": "42",
                },
                "contentDetails": {"relatedPlaylists": {"uploads": "UUplaylist123"}},
            }
        ]
    }
    responses.add(responses.GET, CHANNELS_URL, json=payload, status=200)
    responses.add(responses.GET, PLAYLIST_ITEMS_URL, json={"items": []}, status=200)
    supabase = mock_supabase()

    yt_pipeline.process_artist(supabase, "fake-key", ARTIST_ROW, date(2026, 8, 31))

    snapshot_payload = supabase.table.return_value.insert.call_args_list[0].args[0]
    assert snapshot_payload["subscribers"] is None


# ---------------------------------------------------------------------------
# run_pipeline
# ---------------------------------------------------------------------------

def mock_supabase_with_artist_rows(rows):
    supabase = MagicMock()
    supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = rows
    return supabase


def test_run_pipeline_artist_not_found_skips_without_calling_process_artist(monkeypatch):
    mock_process_artist = Mock()
    monkeypatch.setattr(yt_pipeline, "process_artist", mock_process_artist)
    supabase = mock_supabase_with_artist_rows([])

    failures = yt_pipeline.run_pipeline(supabase, "fake-key", ["Ghost Artist"])

    assert failures == [
        {"artist": "Ghost Artist", "reason": "no matching row in the artists table"}
    ]
    mock_process_artist.assert_not_called()


def test_run_pipeline_success_reports_no_failures(monkeypatch):
    mock_process_artist = Mock(return_value=None)
    monkeypatch.setattr(yt_pipeline, "process_artist", mock_process_artist)
    row = {"id": 1, "youtube_handle": "h", "youtube_channel_id": "c"}
    supabase = mock_supabase_with_artist_rows([row])

    failures = yt_pipeline.run_pipeline(supabase, "fake-key", ["Real Artist"])

    assert failures == []
    mock_process_artist.assert_called_once()
    args = mock_process_artist.call_args.args
    assert args[0] is supabase
    assert args[1] == "fake-key"
    assert args[2] == row


def test_run_pipeline_http_error_reason_uses_http_prefix(monkeypatch):
    response = Mock(status_code=403)
    error = requests.exceptions.HTTPError(response=response)
    monkeypatch.setattr(yt_pipeline, "process_artist", Mock(side_effect=error))
    row = {"id": 1, "youtube_handle": "h", "youtube_channel_id": "c"}
    supabase = mock_supabase_with_artist_rows([row])

    failures = yt_pipeline.run_pipeline(supabase, "fake-key", ["Some Artist"])

    assert failures == [{"artist": "Some Artist", "reason": "HTTP error: HTTP 403"}]


def test_run_pipeline_non_http_request_error_reason_uses_request_prefix(monkeypatch):
    error = requests.exceptions.Timeout()
    monkeypatch.setattr(yt_pipeline, "process_artist", Mock(side_effect=error))
    row = {"id": 1, "youtube_handle": "h", "youtube_channel_id": "c"}
    supabase = mock_supabase_with_artist_rows([row])

    failures = yt_pipeline.run_pipeline(supabase, "fake-key", ["Some Artist"])

    assert failures == [{"artist": "Some Artist", "reason": "request failed: Timeout"}]


def test_run_pipeline_generic_exception_reason_includes_type_and_message(monkeypatch):
    monkeypatch.setattr(
        yt_pipeline, "process_artist", Mock(side_effect=ValueError("bad row"))
    )
    row = {"id": 1, "youtube_handle": "h", "youtube_channel_id": "c"}
    supabase = mock_supabase_with_artist_rows([row])

    failures = yt_pipeline.run_pipeline(supabase, "fake-key", ["Some Artist"])

    assert failures == [{"artist": "Some Artist", "reason": "ValueError: bad row"}]


def test_run_pipeline_one_failure_does_not_stop_the_run(monkeypatch):
    row = {"id": 1, "youtube_handle": "h", "youtube_channel_id": "c"}
    mock_process_artist = Mock(side_effect=[ValueError("boom"), None])
    monkeypatch.setattr(yt_pipeline, "process_artist", mock_process_artist)
    supabase = mock_supabase_with_artist_rows([row])

    failures = yt_pipeline.run_pipeline(supabase, "fake-key", ["Artist A", "Artist B"])

    assert failures == [{"artist": "Artist A", "reason": "ValueError: boom"}]
    assert mock_process_artist.call_count == 2


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def test_main_calls_run_pipeline_with_module_level_dependencies(monkeypatch):
    mock_run_pipeline = Mock()
    monkeypatch.setattr(yt_pipeline, "run_pipeline", mock_run_pipeline)

    yt_pipeline.main()

    mock_run_pipeline.assert_called_once_with(
        yt_pipeline.supabase, yt_pipeline.yt_api_key, yt_pipeline.artists
    )
