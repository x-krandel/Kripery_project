import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db import init_db
from app.routers import ai, artworks, auctions, auth, lost, posts, stats, uploads, users
from app.services import auction_engine, bootstrap, embeddings

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await run_in_threadpool(init_db)
    await run_in_threadpool(embeddings.load_model)
    tasks = [asyncio.create_task(auction_engine.run_loop())]
    # The lost dataset lives in the repo, so every start brings the table in line
    # with it; AUTO_SEED does that too, before seeding.
    job = bootstrap.run if settings.auto_seed else bootstrap.sync_lost
    tasks.append(asyncio.create_task(_bootstrap(job)))
    yield
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)


async def _bootstrap(job) -> None:
    try:
        await run_in_threadpool(job)
    except Exception:  # a failed seed or sync must not take the API down
        logging.getLogger("rodowod.bootstrap").exception("%s failed", job.__name__)


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


for module in (auth, users, uploads, ai, artworks, auctions, lost, stats, posts):
    api.include_router(module.router)
app.include_router(api)

settings.media_dir.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")
