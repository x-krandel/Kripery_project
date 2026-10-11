import { useEffect, useRef, useState } from "react";

const full = new Intl.NumberFormat("pl-PL", { useGrouping: "always" } as Intl.NumberFormatOptions);
const short = new Intl.NumberFormat("pl-PL", { notation: "compact", maximumSignificantDigits: 3 }); // 10 064 100 → "10,1 mln"

/** Counts from 0 to `to` the first time it scrolls into view. `compact` shortens millions ("10,1 mln"),
 *  the exact number stays in the tooltip. */
export function CountUp({ to, suffix = "", durationMs = 1600, compact = false }: {
  to: number; suffix?: string; durationMs?: number; compact?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // With reduced motion the final number is shown right away, no animation.
  const [reduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [value, setValue] = useState(() => (reduced ? to : 0));

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    let raf = 0;
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      obs.disconnect();
      const start = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - start) / durationMs);
        setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    obs.observe(el);
    return () => { obs.disconnect(); cancelAnimationFrame(raf); };
  }, [to, durationMs, reduced]);

  const text = compact && value >= 1_000_000 ? short.format(value) : full.format(value);
  const exact = compact && to >= 1_000_000 ? `${full.format(to)}${suffix}` : undefined;
  return <span ref={ref} title={exact}>{text}{suffix}</span>;
}
