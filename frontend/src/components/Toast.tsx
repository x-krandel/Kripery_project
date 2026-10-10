import { useCallback, useRef, useState, type ReactNode } from "react";
import { ToastContext, type ToastTone } from "../hooks/toastContext";
import { Check, ShieldAlert } from "./Icons";

interface ToastItem { id: number; text: string; tone: ToastTone }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const show = useCallback((text: string, tone: ToastTone = "ok") => {
    const id = nextId.current++;
    setItems((xs) => [...xs, { id, text, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="animate-toast-in flex max-w-md items-center gap-2.5 rounded-2xl bg-ink px-4 py-3.5 text-[15px] font-semibold text-ground shadow-[0_16px_32px_-16px_rgba(23,20,15,0.5)]">
            {t.tone === "ok" ? <Check className="text-[#9BD3B0]" /> : <ShieldAlert className="text-[#F2A79F]" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
