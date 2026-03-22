from pathlib import Path
from dotenv import load_dotenv

# Cargar .env ANTES de importar cualquier módulo de app (database.py lee DATABASE_URL al importarse)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, user, match, favorites, application, history, cover_letter

app = FastAPI(title="JobMatch-IA API")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(match.router)
app.include_router(auth.router)
app.include_router(user.router)
app.include_router(favorites.router)
app.include_router(application.router)
app.include_router(history.router)
app.include_router(cover_letter.router)


@app.get("/")
def root():
    return {"message": "JobMatch-IA API running"}
