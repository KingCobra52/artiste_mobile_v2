from unittest.mock import Mock

import pytest
import requests

import pipelines.pipeline as pipeline


# ---------------------------------------------------------------------------
# run_all
# ---------------------------------------------------------------------------

def test_run_all_calls_each_pipeline_with_its_own_api_key(monkeypatch):
    fn_a = Mock(return_value=[])
    fn_b = Mock(return_value=[{"artist": "X", "reason": "boom"}])
    monkeypatch.setattr(
        pipeline, "PIPELINES", [("fake-a", fn_a, "key-a"), ("fake-b", fn_b, "key-b")]
    )
    supabase = object()
    artists = ["Artist"]

    results = pipeline.run_all(supabase, artists)

    assert results == [
        ("fake-a", [], False),
        ("fake-b", [{"artist": "X", "reason": "boom"}], False),
    ]
    fn_a.assert_called_once_with(supabase, "key-a", artists)
    fn_b.assert_called_once_with(supabase, "key-b", artists)


def test_run_all_one_pipeline_crashing_does_not_stop_the_next(monkeypatch):
    fn_a = Mock(side_effect=requests.exceptions.Timeout())
    fn_b = Mock(return_value=[])
    monkeypatch.setattr(
        pipeline, "PIPELINES", [("fake-a", fn_a, "key-a"), ("fake-b", fn_b, "key-b")]
    )

    results = pipeline.run_all(object(), ["Artist"])

    assert results == [("fake-a", [], True), ("fake-b", [], False)]
    fn_b.assert_called_once()


def test_run_all_generic_exception_marks_pipeline_crashed(monkeypatch):
    fn_a = Mock(side_effect=ValueError("boom"))
    monkeypatch.setattr(pipeline, "PIPELINES", [("fake-a", fn_a, "key-a")])

    results = pipeline.run_all(object(), ["Artist"])

    assert results == [("fake-a", [], True)]


def test_run_all_preserves_pipelines_order(monkeypatch):
    fn_a = Mock(return_value=[])
    fn_b = Mock(return_value=[])
    fn_c = Mock(return_value=[])
    monkeypatch.setattr(
        pipeline,
        "PIPELINES",
        [("a", fn_a, "ka"), ("b", fn_b, "kb"), ("c", fn_c, "kc")],
    )

    results = pipeline.run_all(object(), [])

    assert [name for name, _, _ in results] == ["a", "b", "c"]


# ---------------------------------------------------------------------------
# print_summary
# ---------------------------------------------------------------------------

def test_print_summary_no_failures(capsys):
    pipeline.print_summary([("youtube", [], False)], total=5)

    out = capsys.readouterr().out
    assert "youtube: 5 artists, 0 failed" in out


def test_print_summary_with_failures_lists_each_artist(capsys):
    results = [("youtube", [{"artist": "A", "reason": "boom"}], False)]

    pipeline.print_summary(results, total=5)

    out = capsys.readouterr().out
    assert "youtube: 5 artists, 1 failed" in out
    assert "A: boom" in out


def test_print_summary_crashed_pipeline_skips_artist_count_line(capsys):
    pipeline.print_summary([("lastfm", [], True)], total=5)

    out = capsys.readouterr().out
    assert "lastfm: crashed, nothing recorded" in out
    assert "artists," not in out


def test_print_summary_mixed_results(capsys):
    results = [
        ("lastfm", [], True),
        ("youtube", [{"artist": "A", "reason": "boom"}], False),
    ]

    pipeline.print_summary(results, total=3)

    out = capsys.readouterr().out
    assert "lastfm: crashed, nothing recorded" in out
    assert "youtube: 3 artists, 1 failed" in out
    assert "A: boom" in out


def test_print_summary_prints_header_and_dividers(capsys):
    pipeline.print_summary([], total=0)

    out = capsys.readouterr().out
    assert "pipeline summary for" in out
    assert out.count("=" * 56) == 2


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def test_main_exits_zero_when_nothing_broken(monkeypatch):
    monkeypatch.setattr(pipeline, "artists", ["A", "B"])
    mock_run_all = Mock(return_value=[("youtube", [], False)])
    monkeypatch.setattr(pipeline, "run_all", mock_run_all)

    with pytest.raises(SystemExit) as exc_info:
        pipeline.main()

    assert exc_info.value.code == 0
    mock_run_all.assert_called_once_with(pipeline.supabase, ["A", "B"])


def test_main_exits_one_when_a_pipeline_crashed(monkeypatch, capsys):
    monkeypatch.setattr(pipeline, "artists", ["A", "B"])
    monkeypatch.setattr(pipeline, "run_all", Mock(return_value=[("youtube", [], True)]))

    with pytest.raises(SystemExit) as exc_info:
        pipeline.main()

    assert exc_info.value.code == 1
    assert "Failing the run: youtube" in capsys.readouterr().out


def test_main_exits_one_when_every_artist_failed(monkeypatch):
    monkeypatch.setattr(pipeline, "artists", ["A", "B"])
    failures = [{"artist": "A", "reason": "x"}, {"artist": "B", "reason": "y"}]
    monkeypatch.setattr(
        pipeline, "run_all", Mock(return_value=[("youtube", failures, False)])
    )

    with pytest.raises(SystemExit) as exc_info:
        pipeline.main()

    assert exc_info.value.code == 1


def test_main_exits_zero_on_partial_failure(monkeypatch):
    monkeypatch.setattr(pipeline, "artists", ["A", "B"])
    failures = [{"artist": "A", "reason": "x"}]
    monkeypatch.setattr(
        pipeline, "run_all", Mock(return_value=[("youtube", failures, False)])
    )

    with pytest.raises(SystemExit) as exc_info:
        pipeline.main()

    assert exc_info.value.code == 0


def test_main_empty_artist_list_does_not_read_as_total_wipeout(monkeypatch):
    monkeypatch.setattr(pipeline, "artists", [])
    monkeypatch.setattr(pipeline, "run_all", Mock(return_value=[("youtube", [], False)]))

    with pytest.raises(SystemExit) as exc_info:
        pipeline.main()

    assert exc_info.value.code == 0
