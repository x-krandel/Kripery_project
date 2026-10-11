import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ApiRequestError } from "../api/client";
import { api } from "../api/endpoints";
import { useToast } from "../hooks/useToast";
import { Modal } from "./Modal";

/** datetime-local value for tomorrow at 18:00, local time. */
function tomorrowEvening(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T18:00`;
}

/** Owner announces an in-person auction; the invitation is published on their profile at once. */
export function OfflineAuctionModal({ open, onClose, artworkId }: { open: boolean; onClose: () => void; artworkId: number }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [when, setWhen] = useState(tomorrowEvening);
  const [place, setPlace] = useState("");
  const [minPrice, setMinPrice] = useState("5000");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () => api.createOfflineAuction({ artworkId, startsAt: new Date(when).toISOString(), place, minPrice: Number(minPrice), body }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["posts"] });
      toast("Zaproszenie opublikowane na Twoim profilu");
      onClose();
    },
    onError: (e) => setError(e instanceof ApiRequestError ? e.message : "Nie udało się opublikować zaproszenia."),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!when || new Date(when).getTime() <= Date.now()) return setError("Wybierz termin w przyszłości.");
    if (place.trim().length < 3) return setError("Podaj miejsce aukcji.");
    if (!(Number(minPrice) > 0)) return setError("Cena minimalna musi być większa od zera.");
    m.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="Aukcja stacjonarna">
      <p className="-mt-2 m-0 text-[15px] text-ink-soft">Zaproszenie od razu pojawi się na Twoim profilu i przy dziele.</p>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-2 text-sm font-semibold">Termin
          <input className="field" type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold">Miejsce
          <input className="field" required placeholder="np. Galeria przy Rynku 12, Wrocław" value={place} onChange={(e) => setPlace(e.target.value)} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold">Cena minimalna (zł)
          <input className="field" type="number" min={1} required value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold">Opis <span className="font-normal text-muted">(opcjonalnie)</span>
          <textarea className="field min-h-24 py-3" maxLength={3000} placeholder="Godziny oglądania, zasady licytacji, kontakt…" value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        {error && <p role="alert" className="m-0 rounded-xl bg-alert-tint px-4 py-3 text-sm font-semibold text-alert">{error}</p>}
        <button type="submit" disabled={m.isPending} className="btn-primary min-h-[52px] text-base disabled:opacity-60">
          {m.isPending ? "Publikuję…" : "Opublikuj zaproszenie"}
        </button>
      </form>
    </Modal>
  );
}
