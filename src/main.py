from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from src.api.routers import auth, workouts, sleep, nutrition, stats, recommendations

app = FastAPI(title="Health Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": "Данные нарушают ограничения базы данных"},
    )


app.include_router(auth.router)
app.include_router(workouts.router)
app.include_router(sleep.router)
app.include_router(nutrition.router)
app.include_router(stats.router)
app.include_router(recommendations.router)
