import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/endpoints";
import type { AuctionDetailDto, BidDto, UserDto } from "../api/types";

export interface AuctionEnded {
  winner: UserDto | null;
  finalPrice: number;
}

export interface AuctionSocketState {
  auction: AuctionDetailDto | null;
  lastBid: BidDto | null;
  ended: AuctionEnded | null;
  connected: boolean;
}

/** Live auction state: snapshot on connect, then bids and the end. Reconnects after 1 s.
 *  `resync()` reconnects to get a fresh snapshot (used after BID_TOO_LOW). */
export function useAuctionSocket(auctionId: number | null): AuctionSocketState & { resync: () => void } {
  const [state, setState] = useState<AuctionSocketState>({ auction: null, lastBid: null, ended: null, connected: false });
  const [nonce, setNonce] = useState(0);
  const endedRef = useRef(false);
  const resync = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (auctionId == null) return;
    let close: (() => void) | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let alive = true;

    const connect = () => {
      close = api.subscribeAuction(
        auctionId,
        (msg) => {
          if (msg.type === "snapshot") {
            endedRef.current = msg.auction.status === "ended";
            setState((s) => ({ ...s, auction: msg.auction, connected: true }));
          } else if (msg.type === "bid") {
            setState((s) => ({
              ...s,
              lastBid: msg.bid,
              auction: s.auction && {
                ...s.auction,
                currentPrice: msg.currentPrice,
                bidCount: msg.bidCount,
                endsAt: msg.endsAt,
                leader: msg.bid.user,
                bids: [msg.bid, ...s.auction.bids.filter((b) => b.id !== msg.bid.id)].slice(0, 10),
              },
            }));
          } else {
            endedRef.current = true;
            setState((s) => ({
              ...s,
              ended: { winner: msg.winner, finalPrice: msg.finalPrice },
              auction: s.auction && { ...s.auction, status: "ended", currentPrice: msg.finalPrice },
            }));
          }
        },
        () => {
          setState((s) => ({ ...s, connected: false }));
          if (alive && !endedRef.current) retry = setTimeout(connect, 1000);
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

  return { ...state, resync };
}
