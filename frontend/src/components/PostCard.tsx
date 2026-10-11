import { Link } from "react-router-dom";
import type { PostDto } from "../api/types";
import { formatPln, timeAgo } from "../lib/format";
import { useNow } from "../hooks/useNow";
import { ArtworkFrame } from "./ArtworkFrame";
import { Avatar } from "./Avatar";
import { Calendar, Gavel, MapPin } from "./Icons";

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** .ics file for the invitation, so it lands in the visitor's calendar (2 hours by default). */
function downloadIcs(post: PostDto) {
  if (!post.startsAt) return;
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const end = new Date(new Date(post.startsAt).getTime() + 2 * 3_600_000).toISOString();
  // RFC 5545 text escaping: backslash, semicolon, comma, newline.
  const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Rodowod//PL", "BEGIN:VEVENT",
    `UID:post-${post.id}@rodowod`, `DTSTAMP:${stamp(post.createdAt)}`, `DTSTART:${stamp(post.startsAt)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(post.title)}`, `LOCATION:${esc(post.place)}`,
    `DESCRIPTION:${esc([post.minPrice ? `Cena minimalna: ${formatPln(post.minPrice)}` : "", post.body].filter(Boolean).join("\n"))}`,
    "END:VEVENT", "END:VCALENDAR",
  ];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
  a.download = `rodowod-aukcja-${post.id}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Invitation to an offline auction, as shown on the author's profile and on the artwork page. */
export function PostCard({ post, showArtwork = true, onDelete, deleting = false }: {
  post: PostDto; showArtwork?: boolean; onDelete?: () => void; deleting?: boolean;
}) {
  const now = useNow();
  const past = post.startsAt ? new Date(post.startsAt).getTime() < now : false;
  return (
    <article className="flex flex-wrap gap-6 rounded-3xl border border-line bg-surface p-6">
      {showArtwork && post.artwork && (
        <Link to={`/dziela/${post.artwork.id}`} className="block w-[150px] shrink-0" aria-label={post.artwork.title}>
          <ArtworkFrame src={post.artwork.imageUrl} alt={post.artwork.title} mat="sm" />
        </Link>
      )}
      <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-3">
        <span className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] ${past ? "bg-chip text-muted" : "bg-accent/10 text-accent"}`}>
          <Gavel size={14} /> {past ? "Aukcja stacjonarna · odbyła się" : "Aukcja stacjonarna · zaproszenie"}
        </span>
        <h3 className="m-0 font-display text-[28px] font-medium leading-[1.1]">
          {post.artwork ? <Link to={`/dziela/${post.artwork.id}`} className="text-ink no-underline hover:text-accent">{post.artwork.title}</Link> : post.title}
        </h3>
        <dl className="m-0 grid gap-2 text-[15px]">
          {post.startsAt && (
            <div className="flex items-start gap-2.5"><dt className="sr-only">Kiedy</dt><Calendar size={18} className="mt-0.5 shrink-0 text-muted" /><dd className="m-0 first-letter:uppercase">{formatEventDate(post.startsAt)}</dd></div>
          )}
          {post.place && (
            <div className="flex items-start gap-2.5"><dt className="sr-only">Gdzie</dt><MapPin size={18} className="mt-0.5 shrink-0 text-muted" /><dd className="m-0">{post.place}</dd></div>
          )}
          {post.minPrice != null && (
            <div className="flex items-baseline gap-2"><dt className="text-ink-soft">Cena minimalna</dt><dd className="m-0 text-lg font-bold">{formatPln(post.minPrice)}</dd></div>
          )}
        </dl>
        {post.body && <p className="m-0 whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{post.body}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-2 text-[13px] text-muted">
            <Avatar id={post.author.id} name={post.author.name} size={24} />
            <Link to={`/kolekcje/${post.author.id}`} className="font-semibold text-ink-soft no-underline hover:text-accent">{post.author.name}</Link>
            · {timeAgo(post.createdAt, now)}
          </span>
          {!past && post.startsAt && (
            <button type="button" onClick={() => downloadIcs(post)} className="btn-quiet min-h-9 px-3 text-sm">
              <Calendar size={15} /> Dodaj do kalendarza
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} disabled={deleting} className="min-h-9 text-sm font-semibold text-alert disabled:opacity-50">
              {deleting ? "Usuwam…" : "Usuń post"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
