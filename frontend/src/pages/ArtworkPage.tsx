import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AddEventModal } from "../components/AddEventModal";
import { ApiRequestError } from "../api/client";
import { api } from "../api/endpoints";
import type { ArtworkDetailDto } from "../api/types";
import { ArtworkFrame } from "../components/ArtworkFrame";
import { ChainPanel, IntegrityBadge, LossCheckBadge } from "../components/Badges";
import { Plus, ShieldAlert } from "../components/Icons";
import { Modal } from "../components/Modal";
import { PassportTimeline } from "../components/PassportTimeline";
import { QrBlock } from "../components/QrBlock";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { useAuctionSocket } from "../hooks/useAuctionSocket";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useNow } from "../hooks/useNow";
import { formatCountdown, formatPln, formatStart, plural, timeAgo } from "../lib/format";
import { roleLabel } from "../lib/labels";

export function ArtworkPage() {
  const id = Number(useParams().id);
  const [params, setParams] = useSearchParams();
  const { userId } = useCurrentUser();
  const artworkQ = useQuery({ queryKey: ["artwork", id], queryFn: () => api.getArtwork(id) });
  const passportQ = useQuery({ queryKey: ["passport", id], queryFn: () => api.getPassport(id) });
  const isOwner = artworkQ.data?.ownerId === userId;
  // ?dodaj-wpis=1 opens the "add event" dialog (used by the red screen's "add documents" button).
  const addOpen = isOwner && params.get("dodaj-wpis") === "1";
  const setAddOpen = (open: boolean) => setParams(open ? { "dodaj-wpis": "1" } : {}, { replace: true });

  if (artworkQ.isError) {
    return (
      <main className="container-page py-24">
        <p className="m-0 text-lg">Nie znaleziono dzieła. <Link to="/aukcje" className="text-accent">Wróć do aukcji</Link></p>
      </main>
    );
  }
  const art = artworkQ.data;
  const passport = passportQ.data;

  return (
    <main className="container-page flex flex-col gap-[72px] pb-28 pt-8">
      <nav aria-label="Ścieżka" className="-mb-10 flex flex-wrap gap-2 text-sm text-muted">
        <Link to="/aukcje" className="text-muted">Aukcje</Link><span aria-hidden="true">/</span>
        <span aria-current="page" className="text-ink">{art?.title ?? "…"}</span>
      </nav>

      <section className="flex flex-wrap items-start gap-16">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-6">
          {art ? <ArtworkFrame src={art.imageUrl} alt={art.title} mat="lg" shadow /> : <Skeleton className="aspect-[4/5] w-full" />}
          {art && <QrBlock artworkId={art.id} title={art.title} />}
        </div>

        <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-7">
          {art ? <ArtworkHeader art={art} /> : <Skeleton className="h-40 w-full" />}
          {art && passport && (
            <div className="flex flex-wrap gap-2">
              <IntegrityBadge chainValid={passport.chainValid} />
              <LossCheckBadge lossCheck={art.lossCheck} />
            </div>
          )}
          {art && <AuctionBox art={art} />}
          {art?.story && (
            <blockquote className="m-0 flex flex-col gap-3">
              <span className="eyebrow">Historia od {art.owner.name.endsWith("a") ? "właścicielki" : "właściciela"}</span>
              <p className="m-0 font-display text-[26px] italic leading-[1.35]">„{art.story}”</p>
              <span className="text-sm text-ink-soft">{art.owner.name}, {roleLabel(art.owner.name, art.owner.role)}</span>
            </blockquote>
          )}
        </div>
      </section>

      <section aria-labelledby="rodowod-title" className="flex flex-col gap-9">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-ink pb-6">
          <div className="flex flex-col gap-2.5">
            <h2 id="rodowod-title" className="m-0 font-display text-5xl font-medium leading-none sm:text-[56px]">Rodowód dzieła</h2>
            <p className="m-0 max-w-[620px] text-[15px] leading-normal text-ink-soft">
              Każdy wpis zawiera skrót SHA-256 poprzedniego. Zmiana dowolnego wpisu wstecz przerywa łańcuch i od razu zmienia status na czerwony.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {passport && (
              <ChainPanel chainValid={passport.chainValid} count={passport.events.length}
                brokenAtSeq={passport.brokenAtSeq} verifiedAt={passport.verifiedAt} />
            )}
            {isOwner && (
              <button type="button" onClick={() => setAddOpen(true)} className="btn-outline min-h-12">
                <Plus size={16} /> Dodaj wpis
              </button>
            )}
          </div>
        </div>
        {art && <AddEventModal open={addOpen} onClose={() => setAddOpen(false)} artworkId={art.id} />}
        {passport ? (
          <PassportTimeline events={passport.events} showUpcoming={art?.auction?.status === "live"} />
        ) : (
          <div className="flex flex-col gap-6">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
        )}
      </section>
    </main>
  );
}

function ArtworkHeader({ art }: { art: ArtworkDetailDto }) {
  const a = art.auction;
  return (
    <div className="flex flex-col gap-3">
      <p className="eyebrow m-0">
        Lot {String(art.id).padStart(2, "0")}
        {a?.status === "live" ? " · Aukcja na żywo" : a?.status === "scheduled" ? " · Aukcja wkrótce" : ""}
      </p>
      <h1 className="m-0 font-display text-5xl font-medium leading-none sm:text-[64px]">{art.title}</h1>
      <p className="m-0 text-base text-ink-soft">
        {[`${art.artist}${art.dating ? `, ${art.dating}` : ""}`, art.technique, art.dimensions].filter(Boolean).join(" · ")}
      </p>
      {art.status === "held" && (
        <p className="m-0 mt-2 flex items-center gap-2 rounded-xl bg-alert-tint px-4 py-3 text-sm font-semibold text-alert">
          <ShieldAlert size={18} /> Publikacja wstrzymana: dzieło czeka na weryfikację pochodzenia.
        </p>
      )}
    </div>
  );
}

function AuctionBox({ art }: { art: ArtworkDetailDto }) {
  const { userId } = useCurrentUser();
  const now = useNow();
  const summary = art.auction;
  const live = useAuctionSocket(summary?.status === "live" ? summary.id : null);
  const [open, setOpen] = useState(false);
  const isOwner = art.ownerId === userId;
  const qc = useQueryClient();

  // When the auction ends, the owner and the passport change: refetch both.
  useEffect(() => {
    if (live.ended) void qc.invalidateQueries();
  }, [live.ended, qc]);

  if (!summary) {
    if (!isOwner) {
      return <div className="rounded-[20px] border border-line bg-surface p-7 text-ink-soft">To dzieło jest w kolekcji i nie ma teraz aukcji.</div>;
    }
    return (
      <div className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-7">
        <span className="text-lg font-semibold">To Twoje dzieło</span>
        <span className="text-[15px] text-ink-soft">
          {art.status === "held" ? "Aukcję można wystawić dopiero po weryfikacji pochodzenia." : "Wystaw je na licytację — paszport pójdzie razem z nim."}
        </span>
        <button type="button" disabled={art.status === "held"} onClick={() => setOpen(true)} className="btn-primary min-h-14 text-[17px] disabled:opacity-40">
          Wystaw na aukcję
        </button>
        <CreateAuctionModal open={open} onClose={() => setOpen(false)} artworkId={art.id} />
      </div>
    );
  }

  if (summary.status === "scheduled") {
    return (
      <div className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-7">
        <span className="text-[13px] text-muted">Cena wywoławcza</span>
        <span className="text-[44px] font-bold leading-[1.05]">{formatPln(summary.startPrice)}</span>
        <span className="text-[15px] text-ink-soft">Licytacja rusza {formatStart(summary.startsAt)}</span>
      </div>
    );
  }

  const a = live.auction ?? { ...summary, leader: null, bids: [], minStep: 0, artworkId: art.id };
  const leaderBid = live.auction?.bids[0];
  const next = a.bidCount > 0 ? a.currentPrice + (live.auction?.minStep ?? 0) : a.startPrice;
  const ended = live.ended || a.status === "ended";

  return (
    <div className="flex flex-col gap-5 rounded-[20px] border border-line bg-surface p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-muted">{a.bidCount > 0 ? `Aktualna oferta · ${a.bidCount} ${plural(a.bidCount, "oferta", "oferty", "ofert")}` : "Cena wywoławcza"}</span>
          <span key={a.currentPrice} className="animate-bump text-[44px] font-bold leading-[1.05] tracking-[-0.01em]">{formatPln(a.currentPrice)}</span>
          {leaderBid && <span className="text-sm text-ink-soft">Najwyższa: {leaderBid.user.name}, {timeAgo(leaderBid.createdAt, now)}</span>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[13px] text-muted">{ended ? "Aukcja" : "Koniec za"}</span>
          <span className="font-mono text-4xl font-medium leading-[1.05] text-accent">{ended ? "zakończona" : formatCountdown(a.endsAt, now)}</span>
        </div>
      </div>
      {!ended && (
        <div className="flex flex-wrap gap-3">
          {isOwner ? (
            <span className="flex-1 rounded-full bg-ground px-5 py-4 text-center text-[15px] font-semibold text-ink-soft">To Twoja aukcja — obserwuj ją na żywo</span>
          ) : (
            <Link to={`/dziela/${art.id}/aukcja`} className="btn-primary min-h-14 flex-[1_1_220px] text-[17px]">Licytuj {formatPln(next)}</Link>
          )}
          <Link to={`/dziela/${art.id}/aukcja`} className="btn-quiet min-h-14 px-6 text-base">Widok na żywo</Link>
        </div>
      )}
      <p className="m-0 text-[13px] text-muted">Oferta złożona w ostatnich 30 sekundach przedłuża aukcję o 30 sekund.</p>
    </div>
  );
}

function CreateAuctionModal({ open, onClose, artworkId }: { open: boolean; onClose: () => void; artworkId: number }) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [startPrice, setStartPrice] = useState("1000");
  const [minStep, setMinStep] = useState("100");
  const [duration, setDuration] = useState("3");
  const [error, setError] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () => api.createAuction({ artworkId, startPrice: Number(startPrice), minStep: Number(minStep), durationMinutes: Number(duration) }),
    onSuccess: async () => {
      await qc.invalidateQueries();
      toast("Aukcja wystartowała");
      onClose();
      navigate(`/dziela/${artworkId}/aukcja`);
    },
    onError: (e) => setError(e instanceof ApiRequestError ? e.message : "Nie udało się utworzyć aukcji."),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    m.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="Wystaw na aukcję">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm font-semibold">Cena wywoławcza (zł)
          <input className="field" type="number" min={1} required value={startPrice} onChange={(e) => setStartPrice(e.target.value)} />
        </label>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-2 text-sm font-semibold">Minimalne podbicie (zł)
            <input className="field" type="number" min={1} required value={minStep} onChange={(e) => setMinStep(e.target.value)} />
          </label>
          <label className="flex flex-1 flex-col gap-2 text-sm font-semibold">Czas trwania (min)
            <input className="field" type="number" min={1} max={1440} required value={duration} onChange={(e) => setDuration(e.target.value)} />
          </label>
        </div>
        {error && <p className="m-0 rounded-xl bg-alert-tint px-4 py-3 text-sm font-semibold text-alert">{error}</p>}
        <button type="submit" disabled={m.isPending} className="btn-primary min-h-[52px] text-base disabled:opacity-60">
          {m.isPending ? "Uruchamiam…" : "Uruchom licytację"}
        </button>
      </form>
    </Modal>
  );
}
