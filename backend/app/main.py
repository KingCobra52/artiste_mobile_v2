from fastapi import FastAPI
from routers import trading, holdings 

app = FastAPI()

app.include_router(trading.router)
app.include_router(holdings.router)