import type { PassportEventDto } from "../api/types";
import { shortHash } from "../lib/format";
import { EVENT_LABEL } from "../lib/labels";

interface Props {
  events: PassportEventDto[];
  /** Ghost row "Wkrótce": the ownership change that the running auction will append. */
  showUpcoming?: boolean;
}

export function PassportTimeline({ events, showUpcoming = false }: Props) {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  const last = sorted.at(-1)?.seq;
  return (
    <ol className="flex flex-col">
      {sorted.map((ev) => {
        const broken = !ev.valid;
        return (
          <li key={ev.id} className="flex flex-wrap gap-x-7 pb-2">
            <div className="w-[150px] shrink-0 pt-0.5 font-display text-[34px] leading-none">{ev.occurredOn}</div>
            <div aria-hidden="true" className="hidden w-5 shrink-0 flex-col items-center sm:flex">
              <span className={`mt-2 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${broken ? "border-alert bg-alert" : ev.seq === last ? "border-ink bg-ink" : "border-ink bg-ground"}`} />
              <span className="min-h-10 w-px flex-1 bg-line-strong" />
            </div>
            <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-2.5 pb-9 pt-2 sm:pt-0">
              <span className="self-start rounded-full bg-chip px-2.5 py-1 text-xs font-bold uppercase tracking-[0.06em] text-ink-soft">
                {EVENT_LABEL[ev.type]}
              </span>
              <span className="text-xl font-semibold">{ev.title}</span>
              {ev.description && <span className="max-w-[680px] text-[15px] leading-relaxed text-ink-soft">{ev.description}</span>}
              <span className="font-mono text-[13px] text-muted" title={`hash: ${ev.hash}\nprev: ${ev.prevHash}`}>
                #{ev.seq} · {shortHash(ev.hash)} ← {ev.seq === 1 ? "początek" : shortHash(ev.prevHash)}
              </span>
              {broken && (
                <span className="self-start rounded-[10px] bg-alert-tint px-3 py-1.5 text-[13px] font-semibold text-alert">
                  Treść zmieniona po zapisie: skrót się nie zgadza
                </span>
              )}
            </div>
          </li>
        );
      })}
      {showUpcoming && (
        <li className="flex flex-wrap gap-x-7">
          <div className="w-[150px] shrink-0 font-display text-[34px] leading-none text-faint">Wkrótce</div>
          <div aria-hidden="true" className="hidden w-5 shrink-0 justify-center sm:flex">
            <span className="mt-2 h-3.5 w-3.5 rounded-full border-2 border-dashed border-faint" />
          </div>
          <div className="mt-2 min-w-0 flex-[1_1_420px] rounded-2xl border border-dashed border-line-strong px-4.5 py-3.5 text-[15px] text-ink-soft sm:mt-0">
            Po zakończeniu aukcji wpis „Zmiana właściciela” dopisze się automatycznie.
          </div>
        </li>
      )}
    </ol>
  );
}
