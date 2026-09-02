from fastapi import FastAPI

from src.api.routers import auth, workouts, sleep, nutrition

app = FastAPI()

app.include_router(auth.router)
app.include_router(workouts.router)
app.include_router(sleep.router)
app.include_router(nutrition.router)