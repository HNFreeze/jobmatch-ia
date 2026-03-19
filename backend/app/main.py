from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import match

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(title="JobMatch-IA API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(match.router)


@app.get("/")
def root():
    return {"message": "JobMatch-IA API running"}
