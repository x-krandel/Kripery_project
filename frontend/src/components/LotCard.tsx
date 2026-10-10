import { Link } from "react-router-dom";
import type { ArtworkSummaryDto } from "../api/types";
import { useNow } from "../hooks/useNow";
import { attribution, formatCountdown, formatPln, formatStart } from "../lib/format";
import { ArtworkFrame } from "./ArtworkFrame";
import { LiveChip, SoonChip } from "./Badges";
import { Clock } from "./Icons";

export function LotCard({ artwork, size = "md" }: { artwork: ArtworkSummaryDto; size?: "md" | "lg" }) {
  const now = useNow();
  const a = artwork.auction;
  const live = a?.status === "live";
  const hasBids = (a?.bidCount ?? 0) > 0;

  return (
    <Link to={`/dziela/${artwork.id}`} className="group flex min-w-0 flex-col gap-4 text-ink no-underline">
      <div className="relative transition-transform duration-300 group-hover:-translate-y-1">
        <ArtworkFrame src={artwork.imageUrl} alt={artwork.title} mat={size === "lg" ? "md" : "md"} />
        {live && <LiveChip className="absolute left-7 top-7" />}
        {a?.status === "scheduled" && <SoonChip className="absolute left-7 top-7" />}
      </div>
      <div className="flex flex-col gap-1">
        <span className={`font-display leading-[1.1] ${size === "lg" ? "text-[28px]" : "text-[25px]"}`}>{artwork.title}</span>
        <span className="text-[13px] text-muted">{attribution(artwork)}</span>
      </div>
      {a ? (
        <div className="flex items-end justify-between gap-3 border-t border-line pt-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted">{live && hasBids ? "Aktualna oferta" : "Cena wywoławcza"}</span>
            <span className="text-xl font-bold">{formatPln(live ? a.currentPrice : a.startPrice)}</span>
          </div>
          {live ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[13px] font-semibold text-accent">
              <Clock size={15} /> {formatCountdown(a.endsAt, now)}
            </span>
          ) : (
            <span className="text-[13px] font-semibold text-muted">{formatStart(a.startsAt)}</span>
          )}
        </div>
      ) : (
        <div className="border-t border-line pt-3 text-[13px] text-muted">W kolekcji, bez aukcji</div>
      )}
    </Link>
  );
}
