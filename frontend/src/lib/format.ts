// pl-PL does not group 4-digit numbers by default ("4000"), the design wants "4 000".
const pln = new Intl.NumberFormat("pl-PL", { useGrouping: "always" } as Intl.NumberFormatOptions);

export function formatPln(amount: number): string {
  return `${pln.format(amount)} zł`;
}

export function shortHash(hash: string): string {
  return hash.length > 10 ? `${hash.slice(0, 4)}…${hash.slice(-4)}` : hash;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "02:41", "1:12:30", "2 dni" — time left until `endsAt`. */
export function formatCountdown(endsAt: string, now: number): string {
  const ms = Math.max(0, new Date(endsAt).getTime() - now);
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86_400);
  if (days >= 2) return `${days} dni`;
  if (days === 1) return "1 dzień";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function secondsLeft(endsAt: string, now: number): number {
  return Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000));
}

export function timeAgo(iso: string, now: number): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 10) return "przed chwilą";
  if (s < 60) return `${s} s temu`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min temu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} godz. temu`;
  return `${Math.floor(h / 24)} dni temu`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatStart(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Polish plural: plural(1, "oferta", "oferty", "ofert"), 3 → "oferty", 5 → "ofert", 22 → "oferty". */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const d = n % 10, dd = n % 100;
  return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? few : many;
}

export function attribution(a: { artist: string; dating: string; technique?: string }): string {
  const who = [a.artist, a.dating].filter(Boolean).join(", ");
  return [who, a.technique].filter(Boolean).join(" · ");
}
