"""
The entry point the cron job calls.

Runs every pipeline in one process, prints a summary naming any artist that
failed, and exits non-zero only when a whole pipeline is broken. A single bad
artist is reported but does not fail the job, because a name that has drifted
in artists.py should not turn the run red every night until it is fixed.
"""

import sys
from datetime import date
from pipelines.http_errors import describe_request_error

from backend.app.config import lastfm_api_key, yt_api_key
from backend.app.supabase_client import supabase
from pipelines import last_fm_pipeline, yt_pipeline
from pipelines.artists import artists
from requests.exceptions import RequestException

# YouTube goes first. It is the one with a daily quota, so an exhausted quota
# shows up before any time is spent on Last.fm.
PIPELINES = [
    ("youtube", yt_pipeline.run_pipeline, yt_api_key),
    ("lastfm", last_fm_pipeline.run_pipeline, lastfm_api_key),
]


def run_all(supabase, artists):
    """
    Run every pipeline in order. Returns (name, failures, crashed) per pipeline.

    Each run_pipeline already swallows per-artist errors, so reaching the except
    below means something broke outside the artist loop. Catching it here is what
    lets a dead YouTube run still leave Last.fm to do its work.
    """
    results = []

    for name, run_pipeline, api_key in PIPELINES:
        try:
            failures = run_pipeline(supabase, api_key, artists)
            results.append((name, failures, False))
        except RequestException as e:
            print(f"{name} pipeline crashed: {describe_request_error(e)}")
            results.append((name, [], True))
        except Exception as e:
            print(f"{name} pipeline crashed: {type(e).__name__}: {e}")
            results.append((name, [], True))

    return results


def print_summary(results, total):
    """
    Print the per-artist detail. This is the notification surface for now:
    cron mails or logs stdout, so naming the artists here is what makes a
    partial failure findable later.
    """
    print()
    print("=" * 56)
    print(f"pipeline summary for {date.today()}")

    for name, failures, crashed in results:
        if crashed:
            print(f"  {name}: crashed, nothing recorded")
            continue

        print(f"  {name}: {total} artists, {len(failures)} failed")
        for failure in failures:
            print(f"      {failure['artist']}: {failure['reason']}")

    print("=" * 56)


def main():
    total = len(artists)
    results = run_all(supabase, artists)
    print_summary(results, total)

    # Non-zero for a crash, or for a pipeline that failed every artist. Those are
    # the systemic cases: a dead key, an exhausted quota, Supabase unreachable.
    # `total and` keeps an empty artist list from reading as a total wipeout.
    broken = [
        name
        for name, failures, crashed in results
        if crashed or (total and len(failures) == total)
    ]

    if broken:
        print(f"Failing the run: {', '.join(broken)}")
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
