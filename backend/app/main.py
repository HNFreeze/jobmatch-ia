from pathlib import Path
import os
from dotenv import load_dotenv
from urllib.parse import urlparse

# Cargar .env ANTES de importar cualquier módulo de app (database.py lee DATABASE_URL al importarse)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, user, match, favorites, application, history, cover_letter, company

app = FastAPI(title="JobMatch-IA API")

frontend_url = os.getenv("APP_FRONTEND_URL", "").strip()
allowed_origins = []
if frontend_url:
    allowed_origins.append(frontend_url.rstrip("/"))
    parsed = urlparse(frontend_url)
    if parsed.scheme and parsed.hostname:
        allowed_origins.append(f"{parsed.scheme}://{parsed.hostname}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"(http://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?|https://([a-zA-Z0-9-]+\.)*vercel\.app)$",
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
app.include_router(company.router)


@app.get("/")
def root():
    return {"message": "JobMatch-IA API running"}
