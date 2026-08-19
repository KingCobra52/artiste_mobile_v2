"""
Helpers for reporting failed requests.

Both APIs put their key in the URL. YouTube uses `key=`, Last.fm uses
`api_key=`. requests builds error messages out of the URL, so printing an
exception prints the key.
"""


def describe_request_error(exc):
    """
    Describe a failed request without the URL.

    Returns "HTTP 403" when there is a response.
    Returns the exception name otherwise, like "Timeout".
    """
    response = getattr(exc, "response", None)
    if response is not None:
        return f"HTTP {response.status_code}"
    return type(exc).__name__
