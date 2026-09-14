from typing import Any

from pydantic import BaseModel, ConfigDict


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    message: str
    request_id: str
    field_errors: dict[str, Any] | None = None


NOT_IMPLEMENTED_RESPONSE = {
    501: {"model": ErrorResponse, "description": "Domain capability is not connected"}
}
PROTECTED_NOT_IMPLEMENTED_RESPONSES = {
    401: {"model": ErrorResponse, "description": "Missing or invalid access token"},
    **NOT_IMPLEMENTED_RESPONSE,
}
