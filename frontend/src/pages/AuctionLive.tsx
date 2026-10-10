import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiRequestError } from "../api/client";
import { api } from "../api/endpoints";
import { ArtworkFrame } from "../components/ArtworkFrame";
import { ArrowLeft, LiveDot, ShieldCheck } from "../components/Icons";
import { useToast } from "../hooks/useToast";
import { Avatar } from "../components/UserSwitcher";
import { useAuctionSocket } from "../hooks/useAuctionSocket";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useNow } from "../hooks/useNow";
import { formatCountdown, formatPln, secondsLeft, timeAgo } from "../lib/format";

const STEPS = [100, 500, 1000];

/** Mobile-first live auction — the screen shown on two phones on stage. */
export function AuctionLive() {
  const id = Number(useParams().id);
  const { userId, user } = useCurrentUser();
  const toast = useToast();
  const qc = useQueryClient();
  const now = useNow();
  const [step, setStep] = useState(100);

  const artQ = useQuery({ queryKey: ["artwork", id], queryFn: () => api.getArtwork(id) });
  const art = artQ.data;
  const auctionId = art?.auction?.id ?? null;
  const { auction, ended, connected, resync } = useAuctionSocket(auctionId);

  useEffect(() => {
    if (ended) void qc.invalidateQueries();
  }, [ended, qc]);

  const bid = useMutation({
    mutationFn: (amount: number) => api.placeBid(auctionId!, { amount }),
    onSuccess: (b) => toast(`Oferta przyjęta: ${formatPln(b.amount)}`),
    onError: (e) => {
      toast(e instanceof ApiRequestError ? e.message : "Nie udało się złożyć oferty.", "error");
      if (e instanceof ApiRequestError && e.code === "BID_TOO_LOW") resync(); // someone was faster: fetch a fresh snapshot
    },
  });

  const isOwner = art?.ownerId === userId;
  const minStep = auction?.minStep ?? 0;
  const next = auction ? (auction.bidCount > 0 ? auction.currentPrice + Math.max(step, minStep) : auction.startPrice) : 0;
  const youLead = auction?.leader?.id === userId;
  const urgent = auction ? secondsLeft(auction.endsAt, now) <= 30 : false;

  return (
    <div className="min-h-screen bg-ground">
      <div className="relative mx-auto flex min-h-screen w-full max-w-[430px] flex-col">
        <div className="flex items-center gap-2 py-3 pl-1 pr-3">
          <Link to={`/dziela/${id}`} aria-label="Wróć do dzieła" className="flex h-11 w-11 items-center justify-center text-ink"><ArrowLeft size={22} /></Link>
          <span className="flex-1 text-base font-bold">Aukcja na żywo</span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold tracking-[0.04em] ${connected ? "bg-alert-tint text-alert" : "bg-chip text-muted"}`}>
            {connected ? <><LiveDot /> NA ŻYWO</> : "ŁĄCZENIE…"}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-3.5 px-4 pb-4">
          {art && <ArtworkFrame src={art.imageUrl} alt={art.title} mat="sm" imgClassName="h-[196px]" />}

          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-display text-[26px] leading-[1.1]">{art?.title ?? "…"}</span>
              <span className="text-[13px] text-muted">{art ? `${art.artist}, ${art.dating}` : ""}</span>
            </div>
            {art?.verified && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ok-tint px-2.5 py-1 text-xs font-bold text-ok">
                <ShieldCheck size={13} strokeWidth={2.25} /> Rodowód OK
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-line bg-surface px-4.5 py-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted">{auction && auction.bidCount > 0 ? "Aktualna oferta" : "Cena wywoławcza"}</span>
              <span key={auction?.currentPrice} aria-live="polite" className="animate-bump text-[34px] font-bold leading-[1.1] tracking-[-0.01em]">
                {auction ? formatPln(auction.currentPrice) : "—"}
              </span>
              {youLead ? (
                <span className="mt-1 self-start rounded-full bg-ok-tint px-2.5 py-0.5 text-xs font-bold text-ok">Prowadzisz</span>
              ) : auction?.leader ? (
                <span className="text-[13px] text-ink-soft">Prowadzi: {auction.leader.name}</span>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-xs text-muted">Koniec za</span>
              <span className={`font-mono text-[28px] font-medium leading-[1.1] ${urgent ? "text-alert" : "text-accent"}`}>
                {auction ? formatCountdown(auction.endsAt, now) : "--:--"}
              </span>
            </div>
          </div>

          <div className="flex flex-col">
            <span className="pb-1.5 text-xs font-bold uppercase tracking-[0.08em] text-muted">Ostatnie oferty</span>
            <ul className="m-0 list-none p-0">
              {(auction?.bids ?? []).slice(0, 4).map((b) => (
                <li key={b.id} className="flex min-h-10 items-center justify-between border-b border-line text-sm">
                  <span className="flex items-center gap-2.5">
                    <Avatar id={b.user.id} name={b.user.name} size={26} />
                    <span className="font-semibold">{b.user.id === userId ? "Ty" : b.user.name}</span>
                    <span className="text-[13px] text-muted">{timeAgo(b.createdAt, now)}</span>
                  </span>
                  <span className="font-bold">{formatPln(b.amount)}</span>
                </li>
              ))}
              {auction && auction.bids.length === 0 && <li className="py-3 text-sm text-muted">Jeszcze nikt nie licytował. Bądź pierwszy!</li>}
            </ul>
          </div>
        </div>

        <div className="sticky bottom-0 flex flex-col gap-3 border-t border-line bg-surface px-4 pb-6 pt-3.5">
          {isOwner ? (
            <p className="m-0 py-3 text-center text-sm font-semibold text-ink-soft">To Twoja aukcja. {user?.name}, zmień użytkownika, aby licytować.</p>
          ) : (
            <>
              <div role="group" aria-label="Wysokość podbicia" className="grid grid-cols-3 gap-2">
                {STEPS.map((s) => (
                  <button key={s} type="button" aria-pressed={step === s} onClick={() => setStep(s)}
                    className={`min-h-11 rounded-xl border text-[15px] font-bold ${step === s ? "border-ink bg-ink text-ground" : "border-line-strong bg-surface text-ink"}`}>
                    +{formatPln(s)}
                  </button>
                ))}
              </div>
              <button type="button" disabled={!auction || auction.status !== "live" || bid.isPending} onClick={() => bid.mutate(next)}
                className="min-h-14 rounded-full bg-accent text-lg font-bold text-white transition-colors hover:bg-accent-dark disabled:opacity-50">
                {bid.isPending ? "Wysyłam…" : `Licytuj ${formatPln(next)}`}
              </button>
            </>
          )}
          <span className="text-center text-xs text-muted">Oferta w ostatnich 30 s przedłuża aukcję o 30 s</span>
        </div>

        {ended && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/55 p-6">
            <div className="flex w-full flex-col gap-4 rounded-3xl bg-surface p-7 text-center">
              {ended.winner?.id === userId ? (
                <>
                  <span className="font-display text-4xl font-semibold leading-none text-accent">{user?.name.endsWith("a") ? "Wygrałaś!" : "Wygrałeś!"}</span>
                  <span className="text-[15px] text-ink-soft">Dzieło trafia do Twojej kolekcji za {formatPln(ended.finalPrice)}. Nowy wpis jest już w paszporcie.</span>
                </>
              ) : (
                <>
                  <span className="font-display text-4xl font-semibold leading-none">Aukcja zakończona</span>
                  <span className="text-[15px] text-ink-soft">
                    {ended.winner ? `Wygrywa ${ended.winner.name} z ofertą ${formatPln(ended.finalPrice)}.` : "Nikt nie złożył oferty."}
                  </span>
                </>
              )}
              <Link to={`/dziela/${id}`} className="btn-dark min-h-[52px]">Zobacz paszport dzieła</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
