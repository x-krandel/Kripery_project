import { useCallback, useEffect, useRef, useState } from "react";
import { WS_CLOSE_NOT_FOUND } from "../api/client";
import { api } from "../api/endpoints";
import type { AuctionDetailDto, AuctionWsMessage, BidDto, ChatMessageDto, UserDto } from "../api/types";

export interface AuctionEnded {
  winner: UserDto | null;
  finalPrice: number;
}

export interface AuctionSocketState {
  auction: AuctionDetailDto | null;
  lastBid: BidDto | null;
  ended: AuctionEnded | null;
  connected: boolean;
  chat: ChatMessageDto[]; // oldest first
}

/** State tagged with the auction it belongs to, so a new auctionId never shows the previous auction. */
interface Tagged extends AuctionSocketState {
  auctionId: number | null;
}

const MAX_BIDS = 10;
const MAX_CHAT = 100;
const empty = (auctionId: number | null): Tagged => ({ auctionId, auction: null, lastBid: null, ended: null, connected: false, chat: [] });

function applyBid(s: Tagged, msg: Extract<AuctionWsMessage, { type: "bid" }>): Tagged {
  if (!s.auction) return s;
  // Bid broadcasts can arrive out of order (two near-simultaneous bids): keep every bid in the list,
  // but move price, leader and timer forward only.
  const bids = s.auction.bids.some((b) => b.id === msg.bid.id) ? s.auction.bids : [msg.bid, ...s.auction.bids];
  const sorted = [...bids].sort((a, b) => b.id - a.id).slice(0, MAX_BIDS);
  if (msg.bidCount <= s.auction.bidCount) return { ...s, auction: { ...s.auction, bids: sorted } };
  return {
    ...s,
    lastBid: msg.bid,
    auction: { ...s.auction, currentPrice: msg.currentPrice, bidCount: msg.bidCount, endsAt: msg.endsAt, leader: msg.bid.user, bids: sorted },
  };
}

/** Live auction state: snapshot on connect, then bids and the end. Reconnects after 1 s unless the
 *  auction is over or does not exist (close code 4404). `resync()` reconnects to get a fresh snapshot
 *  (used after BID_TOO_LOW). */
export function useAuctionSocket(auctionId: number | null): AuctionSocketState & { resync: () => void } {
  const [state, setState] = useState<Tagged>(() => empty(auctionId));
  const [nonce, setNonce] = useState(0);
  const endedRef = useRef(false);
  const resync = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (auctionId == null) return;
    let close: (() => void) | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let alive = true;
    endedRef.current = false;
    const update = (fn: (s: Tagged) => Tagged) => setState((s) => fn(s.auctionId === auctionId ? s : empty(auctionId)));

    const connect = () => {
      close = api.subscribeAuction(
        auctionId,
        (msg) => {
          if (msg.type === "snapshot") {
            endedRef.current = msg.auction.status === "ended";
            update((s) => ({ ...s, auction: msg.auction, connected: true, chat: msg.chat ?? s.chat }));
          } else if (msg.type === "bid") {
            update((s) => applyBid(s, msg));
          } else if (msg.type === "chat") {
            update((s) => (s.chat.some((m) => m.id === msg.message.id) ? s : { ...s, chat: [...s.chat, msg.message].slice(-MAX_CHAT) }));
          } else if (msg.type === "ended") {
            endedRef.current = true;
            update((s) => ({
              ...s,
              ended: { winner: msg.winner, finalPrice: msg.finalPrice },
              auction: s.auction && { ...s.auction, status: "ended", currentPrice: msg.finalPrice },
            }));
          }
        },
        (code) => {
          update((s) => ({ ...s, connected: false }));
          if (alive && !endedRef.current && code !== WS_CLOSE_NOT_FOUND) retry = setTimeout(connect, 1000);
        },
      );
    };
    connect();

    return () => {
      alive = false;
      if (retry) clearTimeout(retry);
      close?.();
    };
  }, [auctionId, nonce]);

  const { auctionId: _forId, ...current } = state.auctionId === auctionId ? state : empty(auctionId);
  return { ...current, resync };
}
