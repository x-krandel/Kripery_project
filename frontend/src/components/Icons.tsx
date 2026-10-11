import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 18, children, strokeWidth = 1.75, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const ArrowRight = (p: P) => <Base {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Base>;
export const ArrowLeft = (p: P) => <Base {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Base>;
export const ChevronDown = (p: P) => <Base {...p}><path d="M6 9l6 6 6-6" /></Base>;
export const Plus = (p: P) => <Base strokeWidth={2} {...p}><path d="M12 5v14M5 12h14" /></Base>;
export const Check = (p: P) => <Base strokeWidth={2.25} {...p}><path d="M5 12l5 5L20 7" /></Base>;
export const Close = (p: P) => <Base {...p}><path d="M6 6l12 12M18 6L6 18" /></Base>;
export const Search = (p: P) => <Base {...p}><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.2-4.2" /></Base>;
export const Clock = (p: P) => <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Base>;
export const ShieldCheck = (p: P) => (
  <Base {...p}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" /></Base>
);
export const ShieldAlert = (p: P) => (
  <Base {...p}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /><path d="M12 8v5M12 16h.01" /></Base>
);
export const ChainLink = (p: P) => (
  <Base {...p}>
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  </Base>
);
export const ChainBroken = (p: P) => (
  <Base {...p}>
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
    <path d="M4 4l16 16" />
  </Base>
);
export const Upload = (p: P) => (
  <Base {...p}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></Base>
);
export const Sparkle = (p: P) => (
  <Base {...p}><path d="M12 3l1.8 4.6L18 9.4l-4.2 1.8L12 16l-1.8-4.8L6 9.4l4.2-1.8z" /><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></Base>
);
export const Calendar = (p: P) => <Base {...p}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></Base>;
export const MapPin = (p: P) => <Base {...p}><path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></Base>;
export const Gavel = (p: P) => <Base {...p}><path d="M14 4l6 6M11 7l6 6M8.5 9.5l6 6M13 5.5l-7.5 7.5 3.5 3.5L16.5 9M4 20h9" /></Base>;
export const External = (p: P) => <Base strokeWidth={2} {...p}><path d="M7 17L17 7M9 7h8v8" /></Base>;

export function LiveDot({ className = "" }: { className?: string }) {
  return (
    <span className={`relative inline-flex h-2 w-2 ${className}`} aria-hidden="true">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-alert opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-alert" />
    </span>
  );
}
