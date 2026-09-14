from backend.app.core.config import Settings
from supabase import AsyncClient, create_async_client


async def create_supabase_client(settings: Settings) -> AsyncClient:
    return await create_async_client(
        str(settings.supabase_url).rstrip("/"), settings.supabase_secret_key
    )


async def close_supabase_client(client: AsyncClient) -> None:
    await client.auth.close()
