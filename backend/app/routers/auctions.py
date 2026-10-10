from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool

from app.db import SessionLocal
from app.deps import CurrentUser, Db
from app.errors import NOT_FOUND_AUCTION, not_found
from app.models import Auction
from app.schemas import AuctionDetailDto, BidDto, CreateAuctionRequest, PlaceBidRequest, WsSnapshot
from app.services import auction_engine, views
from app.services.ws_hub import hub

router = APIRouter(tags=["auctions"])

WS_CLOSE_NOT_FOUND = 4404


@router.post("/auctions", response_model=AuctionDetailDto, status_code=201)
def create_auction(db: Db, user: CurrentUser, req: CreateAuctionRequest):
    auction = auction_engine.create_auction(
        db, user, req.artwork_id, req.start_price, req.min_step, req.duration_minutes
    )
    return views.auction_detail(db, auction)


@router.get("/auctions/{auction_id}", response_model=AuctionDetailDto)
def get_auction(db: Db, auction_id: int):
    auction = db.get(Auction, auction_id)
    if auction is None:
        raise not_found(NOT_FOUND_AUCTION)
    return views.auction_detail(db, auction)


@router.post("/auctions/{auction_id}/bids", response_model=BidDto, status_code=201)
async def place_bid(db: Db, user: CurrentUser, auction_id: int, req: PlaceBidRequest):
    message = await run_in_threadpool(auction_engine.place_bid, db, user, auction_id, req.amount)
    # Broadcast only after the commit inside place_bid.
    await hub.broadcast(auction_id, message.model_dump(mode="json", by_alias=True))
    return message.bid


def _snapshot(auction_id: int) -> dict | None:
    with SessionLocal() as db:
        auction = db.get(Auction, auction_id)
        if auction is None:
            return None
        return WsSnapshot(auction=views.auction_detail(db, auction)).model_dump(mode="json", by_alias=True)


@router.websocket("/ws/auctions/{auction_id}")
async def auction_socket(ws: WebSocket, auction_id: int):
    # Accept first: a close before accept turns into an HTTP 403 and the
    # client never sees the 4404 code.
    await ws.accept()
    lock = hub.subscribe(auction_id, ws)
    try:
        # Subscribed before reading the snapshot and holding the socket lock
        # while sending it, so no bid can slip between snapshot and stream.
        async with lock:
            snapshot = await run_in_threadpool(_snapshot, auction_id)
            if snapshot is None:
                await ws.close(code=WS_CLOSE_NOT_FOUND)
                return
            await ws.send_json(snapshot)
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        hub.unsubscribe(auction_id, ws)
