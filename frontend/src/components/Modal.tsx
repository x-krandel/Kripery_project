import { useEffect, useRef, type ReactNode } from "react";
import { Close } from "./Icons";

/** Native <dialog>: focus trap, Esc and backdrop for free. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="modal-title"
      className="m-auto w-[min(92vw,480px)] rounded-3xl border border-line bg-surface p-0 text-ink backdrop:bg-ink/40">
      <div className="flex flex-col gap-5 p-7">
        <div className="flex items-start justify-between gap-4">
          <h2 id="modal-title" className="m-0 font-display text-[32px] font-medium leading-none">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Zamknij" className="-mr-2 -mt-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-ground">
            <Close />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
