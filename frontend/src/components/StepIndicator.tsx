import { Check } from "./Icons";

const STEPS = ["Zdjęcie", "Opis", "Weryfikacja", "Paszport"];

export function StepIndicator({ current }: { current: number }) {
  return (
    <ol aria-label="Kroki" className="flex flex-wrap gap-2 text-sm font-semibold">
      {STEPS.map((label, i) => {
        const n = i + 1;
        if (n < current) {
          return (
            <li key={label} className="flex items-center gap-2 rounded-full bg-ok-tint px-3.5 py-2 text-ok">
              <Check size={14} /> {n} {label}
            </li>
          );
        }
        if (n === current) {
          return <li key={label} aria-current="step" className="rounded-full bg-ink px-3.5 py-2 text-ground">{n} {label}</li>;
        }
        return <li key={label} className="rounded-full border border-line-strong px-3.5 py-2 text-ink-soft">{n} {label}</li>;
      })}
    </ol>
  );
}
