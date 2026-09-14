import pytest

from backend.app.core.errors import DomainNotImplementedError
from backend.app.services.market import MarketService


@pytest.mark.anyio
async def test_service_boundary_is_explicitly_unimplemented():
    with pytest.raises(DomainNotImplementedError):
        await MarketService().list_quotes()
