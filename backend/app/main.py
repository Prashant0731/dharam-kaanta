from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import get_settings
from app.core.database import init_db
from app.api import entries, export

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    print(f"Starting {settings.APP_NAME}...")
    yield
    # Shutdown
    print("Shutting down...")

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(entries.router, prefix=settings.API_V1_PREFIX, tags=["entries"])
app.include_router(export.router, prefix=settings.API_V1_PREFIX, tags=["export"])

@app.get("/")
def root():
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }

@app.get("/health")
def health():
    return {"status": "ok", "timestamp": "2024-01-01T00:00:00Z"}