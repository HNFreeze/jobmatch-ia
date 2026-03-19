from fastapi import FastAPI

app = FastAPI(title="JobMatch-IA API")


@app.get("/")
def root():
    return {"message": "JobMatch-IA API running"}
