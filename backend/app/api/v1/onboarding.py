from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from backend.app.api.dependencies import CurrentUserDep, SupabaseDep
from backend.app.core.errors import AppError

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class OnboardingState(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: int = Field(default=1, ge=0, le=1)
    step: int = Field(default=0, ge=0, le=2)
    completed: bool = False


@router.get("", response_model=OnboardingState)
async def get_onboarding(user: CurrentUserDep, client: SupabaseDep):
    response = (
        await client.table("profiles")
        .select("onboarding_version,onboarding_step,onboarding_completed")
        .eq("id", str(user.id))
        .maybe_single()
        .execute()
    )
    row = getattr(response, "data", None)
    if not row:
        raise AppError(
            status_code=409,
            code="profile_not_ready",
            message="Your account is still being created.",
        )
    return OnboardingState(
        version=row["onboarding_version"],
        step=row["onboarding_step"] if row["onboarding_version"] == 1 else 0,
        completed=row["onboarding_version"] == 1 and row["onboarding_completed"],
    )


@router.patch("", response_model=OnboardingState)
async def save_onboarding(state: OnboardingState, user: CurrentUserDep, client: SupabaseDep):
    if state.version != 1:
        raise AppError(
            status_code=422, code="validation_error", message="Unsupported onboarding version."
        )
    response = (
        await client.table("profiles")
        .update(
            {
                "onboarding_version": state.version,
                "onboarding_step": state.step,
                "onboarding_completed": state.completed,
            }
        )
        .eq("id", str(user.id))
        .execute()
    )
    if not response.data:
        raise AppError(
            status_code=409,
            code="profile_not_ready",
            message="Your account is still being created.",
        )
    return state
