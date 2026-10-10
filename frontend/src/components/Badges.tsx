import type { LossCheckDto } from "../api/types";
import { plural } from "../lib/format";
import { ChainBroken, ChainLink, LiveDot, Search, ShieldAlert, ShieldCheck } from "./Icons";

export function LiveChip({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs font-bold uppercase tracking-[0.06em] text-alert ${className}`}>
      <LiveDot /> Na żywo
    </span>
  );
}

export function SoonChip({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full bg-surface px-2.5 py-1 text-xs font-bold uppercase tracking-[0.06em] text-muted ${className}`}>
      Wkrótce
    </span>
  );
}

export function VerifiedPill({ label = "Zweryfikowany rodowód" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-tint px-3 py-1.5 text-[13px] font-semibold text-ok">
      <ShieldCheck size={14} strokeWidth={2} /> {label}
    </span>
  );
}

export function IntegrityBadge({ chainValid }: { chainValid: boolean }) {
  return chainValid ? (
    <span className="inline-flex items-center gap-2 rounded-full bg-ok-tint px-3.5 py-2 text-sm font-semibold text-ok">
      <ShieldCheck size={16} strokeWidth={2} /> Historia nienaruszona
    </span>
  ) : (
    <span className="inline-flex items-center gap-2 rounded-full bg-alert-tint px-3.5 py-2 text-sm font-semibold text-alert">
      <ShieldAlert size={16} strokeWidth={2} /> Historia została zmieniona
    </span>
  );
}

export function LossCheckBadge({ lossCheck }: { lossCheck: LossCheckDto }) {
  const clear = lossCheck.result === "clear";
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-ink">
      <Search size={16} strokeWidth={2} className={clear ? "text-ok" : "text-alert"} />
      {clear ? "Brak dopasowań w bazie strat wojennych" : "Możliwe dopasowanie w bazie strat wojennych"}
    </span>
  );
}

export function ChainPanel({ chainValid, count, brokenAtSeq, verifiedAt }: {
  chainValid: boolean; count: number; brokenAtSeq: number | null; verifiedAt: string;
}) {
  return chainValid ? (
    <div className="flex items-center gap-3.5 rounded-2xl bg-ok-tint px-4.5 py-3.5 text-ok">
      <ChainLink size={22} />
      <div className="flex flex-col">
        <span className="text-[15px] font-bold">Łańcuch zweryfikowany · {count} {plural(count, "wpis", "wpisy", "wpisów")}</span>
        <span className="text-[13px]">Ostatnie sprawdzenie: {new Date(verifiedAt).toLocaleString("pl-PL")}</span>
      </div>
    </div>
  ) : (
    <div className="flex items-center gap-3.5 rounded-2xl bg-alert-tint px-4.5 py-3.5 text-alert">
      <ChainBroken size={22} />
      <div className="flex flex-col">
        <span className="text-[15px] font-bold">Łańcuch przerwany na wpisie {brokenAtSeq}</span>
        <span className="text-[13px]">Skrót wpisu nie zgadza się z jego treścią</span>
      </div>
    </div>
  );
}

export function AiChip() {
  return <span className="rounded-full bg-brass-tint px-2 py-0.5 text-[11px] font-bold tracking-[0.06em] text-brass">AI</span>;
}
