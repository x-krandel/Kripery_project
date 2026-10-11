import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiRequestError } from "../api/client";
import { api } from "../api/endpoints";
import type { ChatMessageDto } from "../api/types";
import { ArtworkFrame } from "../components/ArtworkFrame";
import { ArrowLeft, ChatBubble, Close, LiveDot, Share, ShieldCheck } from "../components/Icons";
import { useToast } from "../hooks/useToast";
import { Avatar } from "../components/Avatar";
import { useAuctionSocket } from "../hooks/useAuctionSocket";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useNow } from "../hooks/useNow";
import { attribution, formatCountdown, formatPln, plural, secondsLeft, timeAgo } from "../lib/format";
import { isFeminine } from "../lib/labels";

const STEPS = [100, 500, 1000];

/** Mobile-first live auction: the screen shown on two phones on stage. */
export function AuctionLive() {
  const id = Number(useParams().id);
  const { userId, user } = useCurrentUser();
  const toast = useToast();
  const qc = useQueryClient();
  const now = useNow();
  const [step, setStep] = useState(100);
  const [chatOpen, setChatOpen] = useState(false);

  const artQ = useQuery({ queryKey: ["artwork", id], queryFn: () => api.getArtwork(id) });
  const art = artQ.data;
  const auctionId = art?.auction?.id ?? null;
  const { auction, ended, connected, resync, chat } = useAuctionSocket(auctionId);
  const composer = useChatComposer(auctionId);

  // Unread badge on the phone chat button: history from the first snapshot counts as read,
  // and so does everything that arrived while the sheet was open.
  const lastChatId = chat.at(-1)?.id ?? 0;
  const [seenChatId, setSeenChatId] = useState<number | null>(null);
  if (auction && seenChatId === null) setSeenChatId(lastChatId);
  const unread = chatOpen || seenChatId === null ? 0 : chat.filter((m) => m.id > seenChatId && m.user.id !== userId).length;
  const openChat = () => { setSeenChatId(lastChatId); setChatOpen(true); };
  const closeChat = () => { setSeenChatId(lastChatId); setChatOpen(false); };

  // The sheet is phone-only: close it if the window grows to the desktop layout (Tailwind lg = 64rem).
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 64rem)");
    const onChange = () => { if (mq.matches) setChatOpen(false); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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

  const controls =
    userId == null ? (
      <Link to={`/logowanie?next=${encodeURIComponent(`/dziela/${id}/aukcja`)}`}
        className="flex min-h-14 items-center justify-center rounded-full bg-accent text-lg font-bold text-white no-underline hover:bg-accent-dark">
        Zaloguj się, aby licytować
      </Link>
    ) : isOwner ? (
      // The seller cannot bid on their own lot: show how the sale is going and a way to invite bidders.
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[15px] font-bold lg:text-base">Twoja aukcja</span>
          <span className="text-[13px] text-ink-soft lg:text-sm">
            {!auction ? "Łączenie z licytacją…"
              : auction.bidCount === 0 ? "Czekamy na pierwszą ofertę"
              : <>{auction.bidCount} {plural(auction.bidCount, "oferta", "oferty", "ofert")}<span className="max-lg:hidden"> · nowe pojawią się na żywo</span></>}
          </span>
        </div>
        <button type="button" onClick={() => void shareAuction(id, art?.title ?? "", toast)} className="btn-quiet shrink-0 px-4 text-sm">
          <Share size={16} /> Udostępnij
        </button>
      </div>
    ) : (
      <>
        <div role="group" aria-label="Wysokość podbicia" className="grid grid-cols-3 gap-2">
          {STEPS.map((s) => (
            <button key={s} type="button" aria-pressed={step === s} onClick={() => setStep(s)}
              className={`min-h-11 rounded-xl border text-[15px] font-bold ${step === s ? "border-ink bg-ink text-ground" : "border-line-strong bg-surface text-ink hover:border-ink"}`}>
              +{formatPln(s)}
            </button>
          ))}
        </div>
        <button type="button" disabled={!auction || auction.status !== "live" || bid.isPending} onClick={() => bid.mutate(next)}
          className="min-h-14 rounded-full bg-accent text-lg font-bold text-white transition-colors hover:bg-accent-dark disabled:opacity-50">
          {bid.isPending ? "Wysyłam…" : `Licytuj ${formatPln(next)}`}
        </button>
      </>
    );
  const heading = (
    <div className="flex flex-col gap-2 lg:gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5 lg:gap-2">
          <span className="hidden text-xs font-bold uppercase tracking-[0.12em] text-muted lg:block">Aukcja na żywo</span>
          <span className="font-display text-[26px] leading-[1.1] lg:text-[44px] lg:font-medium lg:leading-[1.02]">{art?.title ?? "…"}</span>
          <span className="text-[13px] text-muted lg:text-base lg:text-ink-soft">{art ? attribution({ artist: art.artist, dating: art.dating }) : ""}</span>
        </div>
        {art?.verified && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ok-tint px-2.5 py-1 text-xs font-bold text-ok lg:mt-6 lg:px-3 lg:py-1.5 lg:text-sm">
            <ShieldCheck size={13} strokeWidth={2.25} /> Rodowód OK
          </span>
        )}
      </div>
      {art && <Link to={`/dziela/${id}`} className="hidden self-start text-[15px] font-semibold text-accent lg:inline">Zobacz paszport dzieła →</Link>}
    </div>
  );
  const rule = <span className="text-center text-xs text-muted">Oferta w ostatnich 30 s przedłuża aukcję o 30 s</span>;

  return (
    <div className="min-h-screen bg-ground">
      {/* Phones: one 430px column with the bid bar pinned to the bottom. Desktop (lg+): artwork left, auction panel right. */}
      <div className="relative mx-auto flex min-h-screen w-full max-w-[430px] flex-col lg:max-w-[1280px] lg:px-8">
        <div className="flex items-center gap-2 py-3 pl-1 pr-3 lg:gap-4 lg:border-b lg:border-line lg:px-0 lg:py-[18px]">
          <Link to="/" className="hidden font-display text-[32px] font-semibold italic leading-none text-ink no-underline lg:inline">Rodowód</Link>
          <span className="hidden h-6 w-px bg-line-strong lg:block" aria-hidden="true" />
          <Link to={`/dziela/${id}`} aria-label="Wróć do dzieła" className="flex h-11 w-11 items-center justify-center text-ink lg:w-auto lg:gap-2 lg:text-[15px] lg:font-medium lg:no-underline lg:hover:text-accent">
            <ArrowLeft size={22} /><span className="hidden lg:inline">Wróć do dzieła</span>
          </Link>
          <span className="min-w-0 flex-1 truncate text-base font-bold lg:hidden">Aukcja na żywo</span>
          <span className="hidden flex-1 lg:block" />
          {auctionId != null && (
            <button type="button" onClick={openChat} aria-haspopup="dialog" aria-expanded={chatOpen}
              aria-label={unread > 0 ? `Czat licytacji, nowe wiadomości: ${unread}` : "Czat licytacji"}
              className="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-xs font-bold text-ink lg:hidden">
              <ChatBubble size={16} /> Czat
              {unread > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold leading-none text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
          )}
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold tracking-[0.04em] ${connected ? "bg-alert-tint text-alert" : "bg-chip text-muted"}`}>
            {connected ? <><LiveDot /> NA ŻYWO</> : "ŁĄCZENIE…"}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-3.5 px-4 pb-4 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(380px,1fr)] lg:items-start lg:gap-14 lg:px-0 lg:pb-16 lg:pt-10">
          <section className="flex flex-col gap-3.5 lg:gap-6">
            {art && <ArtworkFrame src={art.imageUrl} alt={art.title} mat="sm" shadow className="lg:p-6" imgClassName="h-[196px] lg:h-[min(68vh,640px)]" />}
            <div className="lg:hidden">{heading}</div>
            {auctionId != null && (
              <div className="hidden flex-col gap-3 rounded-3xl border border-line bg-surface px-7 py-5 lg:flex">
                <span className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Czat licytacji</span>
                <ChatBody messages={chat} userId={userId} artworkId={id} composer={composer} listClassName="h-72" />
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3.5 lg:sticky lg:top-8 lg:gap-5">
            <div className="hidden lg:block">{heading}</div>
            <div className="flex items-center justify-between gap-3 rounded-[18px] border border-line bg-surface px-4.5 py-4 lg:rounded-3xl lg:px-7 lg:py-6">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted lg:text-sm">{auction && auction.bidCount > 0 ? "Aktualna oferta" : "Cena wywoławcza"}</span>
                <span key={auction?.currentPrice} aria-live="polite" className="animate-bump text-[34px] font-bold leading-[1.1] tracking-[-0.01em] lg:text-[44px]">
                  {auction ? formatPln(auction.currentPrice) : "–"}
                </span>
                {youLead ? (
                  <span className="mt-1 self-start rounded-full bg-ok-tint px-2.5 py-0.5 text-xs font-bold text-ok">Prowadzisz</span>
                ) : auction?.leader ? (
                  <span className="text-[13px] text-ink-soft lg:text-[15px]">Prowadzi: {auction.leader.name}</span>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-xs text-muted lg:text-sm">Koniec za</span>
                <span className={`font-mono text-[28px] font-medium leading-[1.1] lg:text-[36px] ${urgent ? "text-alert" : "text-accent"}`}>
                  {auction ? formatCountdown(auction.endsAt, now) : "--:--"}
                </span>
              </div>
            </div>

            <div className="hidden flex-col gap-3 rounded-3xl border border-line bg-surface p-6 lg:flex">
              {controls}
              {rule}
            </div>

            <div className="flex flex-col lg:rounded-3xl lg:border lg:border-line lg:bg-surface lg:px-7 lg:py-5">
              <span className="pb-1.5 text-xs font-bold uppercase tracking-[0.08em] text-muted">Ostatnie oferty</span>
              <ul className="m-0 list-none p-0">
                {(auction?.bids ?? []).slice(0, 8).map((b, i) => (
                  <li key={b.id} className={`flex min-h-10 items-center justify-between border-b border-line text-sm last:border-b-0 lg:min-h-12 lg:text-[15px] ${i >= 4 ? "max-lg:hidden" : ""}`}>
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

          </section>
        </div>

        <div className="sticky bottom-0 flex flex-col gap-3 border-t border-line bg-surface px-4 pb-6 pt-3.5 lg:hidden">
          {controls}
          {rule}
        </div>

        {auctionId != null && (
          <ChatSheet open={chatOpen} onClose={closeChat} count={chat.length}>
            <ChatBody messages={chat} userId={userId} artworkId={id} composer={composer} listClassName="min-h-0 flex-1" />
          </ChatSheet>
        )}

        {ended && (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/55 p-6">
            <div className="flex w-full max-w-[440px] flex-col gap-4 rounded-3xl bg-surface p-7 text-center">
              {ended.winner?.id === userId ? (
                <>
                  <span className="font-display text-4xl font-semibold leading-none text-accent">{user && isFeminine(user.name) ? "Wygrałaś!" : "Wygrałeś!"}</span>
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

/** Phones: the system share sheet; desktop (or no Web Share): copy the auction link. */
async function shareAuction(artworkId: number, title: string, toast: ReturnType<typeof useToast>) {
  const url = `${window.location.origin}/dziela/${artworkId}/aukcja`;
  if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
    try { await navigator.share({ title, text: `Aukcja na żywo: ${title}`, url }); } catch { /* closed the sheet */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Link do aukcji skopiowany");
  } catch {
    toast("Nie udało się skopiować linku.", "error");
  }
}

type ChatComposer = { text: string; setText: (t: string) => void; submit: (e: FormEvent) => void; pending: boolean };

/** One draft for both chat views, so text typed in the phone sheet survives closing it. */
function useChatComposer(auctionId: number | null): ChatComposer {
  const toast = useToast();
  const [text, setText] = useState("");
  const send = useMutation({
    mutationFn: (t: string) => api.postChatMessage(auctionId!, t),
    onSuccess: () => setText(""),
    onError: (e) => toast(e instanceof ApiRequestError ? e.message : "Nie udało się wysłać wiadomości.", "error"),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (t && auctionId != null && !send.isPending) send.mutate(t);
  };
  return { text, setText, submit, pending: send.isPending };
}

/** Message list and input of the auction room chat: history comes with the WebSocket snapshot,
 *  new lines as "chat" messages. The parent decides the list height (`listClassName`). */
function ChatBody({ messages, userId, artworkId, composer, listClassName }: {
  messages: ChatMessageDto[]; userId: number | null; artworkId: number; composer: ChatComposer; listClassName: string;
}) {
  const now = useNow();
  const inputId = useId();
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight; // follow the newest message (and start at the bottom when the sheet opens)
  }, [messages.length]);

  return (
    <>
      <ol ref={listRef} aria-live="polite" className={`m-0 flex list-none flex-col gap-3 overflow-y-auto overscroll-contain p-0 ${listClassName}`}>
        {messages.length === 0 && <li className="m-auto text-center text-sm text-muted">Nikt jeszcze nie pisał. Przywitaj się z licytującymi.</li>}
        {messages.map((m) => (
          <li key={m.id} className="flex items-start gap-2.5">
            <Avatar id={m.user.id} name={m.user.name} size={26} />
            <div className="flex min-w-0 flex-col">
              <span className="text-[13px]">
                <strong className="font-semibold">{m.user.id === userId ? "Ty" : m.user.name}</strong>
                <span className="text-muted"> · {timeAgo(m.createdAt, now)}</span>
              </span>
              <span className="break-words text-[15px] leading-snug">{m.text}</span>
            </div>
          </li>
        ))}
      </ol>
      {userId == null ? (
        <Link to={`/logowanie?next=${encodeURIComponent(`/dziela/${artworkId}/aukcja`)}`} className="text-sm font-semibold text-accent">
          Zaloguj się, aby pisać na czacie
        </Link>
      ) : (
        <form onSubmit={composer.submit} className="flex gap-2">
          <label htmlFor={inputId} className="sr-only">Wiadomość</label>
          <input id={inputId} className="field min-h-11" maxLength={500} autoComplete="off" placeholder="Napisz wiadomość…"
            value={composer.text} onChange={(e) => composer.setText(e.target.value)} />
          <button type="submit" disabled={!composer.text.trim() || composer.pending}
            className="min-h-11 shrink-0 rounded-xl bg-ink px-4 text-sm font-bold text-ground disabled:opacity-40">
            Wyślij
          </button>
        </form>
      )}
    </>
  );
}

/** Phones: the chat as a bottom sheet over the auction (native <dialog>: focus trap and Esc for free). */
function ChatSheet({ open, onClose, count, children }: { open: boolean; onClose: () => void; count: number; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby={titleId}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); /* tap on the backdrop */ }}
      className="mx-auto mb-0 mt-auto h-[72dvh] w-full max-w-[430px] rounded-t-3xl border border-b-0 border-line bg-surface p-0 text-ink backdrop:bg-ink/45">
      {open && (
        <div className="flex h-full flex-col gap-3 px-4 pb-5 pt-2">
          <span className="mx-auto h-1 w-10 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
          <div className="flex items-center justify-between gap-3">
            <h2 id={titleId} className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-muted">
              Czat licytacji{count > 0 && <span className="font-semibold normal-case tracking-normal"> · {count}</span>}
            </h2>
            <button type="button" onClick={onClose} aria-label="Zamknij czat" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-ground">
              <Close />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
