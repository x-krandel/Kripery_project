import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db import init_db
from app.routers import ai, artworks, auctions, lost, uploads, users
from app.services import auction_engine, embeddings

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await run_in_threadpool(init_db)
    await run_in_threadpool(embeddings.load_model)
    loop_task = asyncio.create_task(auction_engine.run_loop())
    yield
    loop_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await loop_task


app = FastAPI(title="Rodowód API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


@api.get("/health", tags=["health"])
def health():
    return {"ok": True}


for module in (users, uploads, ai, artworks, auctions, lost):
    api.include_router(module.router)
app.include_router(api)

settings.media_dir.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")
