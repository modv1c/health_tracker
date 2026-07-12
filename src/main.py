from fastapi import FastAPI

from src.api.routers import auth

app = FastAPI()

app.include_router(auth.router)