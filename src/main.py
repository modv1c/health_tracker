from fastapi import FastAPI

from src.api.routers import auth, workouts

app = FastAPI()

app.include_router(auth.router)
app.include_router(workouts.router)