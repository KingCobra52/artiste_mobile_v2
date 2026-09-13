from fastapi import FastAPI
from routers import holdings, trading

app = FastAPI()

app.include_router(trading.router)
app.include_router(holdings.router)
