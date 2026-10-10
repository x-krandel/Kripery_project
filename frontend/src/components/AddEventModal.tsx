import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ApiRequestError } from "../api/client";
import { api } from "../api/endpoints";
import type { NewPassportEventRequest } from "../api/types";
import { EVENT_LABEL } from "../lib/labels";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

type EventType = NewPassportEventRequest["type"];
const TYPES: EventType[] = ["exhibition", "conservation", "creation"];

const PLACEHOLDER: Record<EventType, string> = {
  exhibition: "np. Wystawa salonowa w Krakowie",
  conservation: "np. Oczyszczenie werniksu",
  creation: "np. Obraz powstaje w Krakowie",
};

/** B7 — owner appends an event to the passport chain. */
export function AddEventModal({ open, onClose, artworkId }: { open: boolean; onClose: () => void; artworkId: number }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [type, setType] = useState<EventType>("exhibition");
  const [occurredOn, setOccurredOn] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () => api.addEvent(artworkId, { type, occurredOn: occurredOn.trim(), title: title.trim(), description: description.trim() }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["passport", artworkId] });
      toast("Wpis dodany do rodowodu");
      setOccurredOn(""); setTitle(""); setDescription("");
      onClose();
    },
    onError: (e) => setError(e instanceof ApiRequestError ? e.message : "Nie udało się dodać wpisu."),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Podaj tytuł wpisu.");
      return;
    }
    m.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="Dodaj wpis do rodowodu">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div role="radiogroup" aria-label="Rodzaj wpisu" className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)}
              className={`btn min-h-10 px-4 text-sm ${type === t ? "border border-ink bg-ink text-ground" : "btn-quiet"}`}>
              {EVENT_LABEL[t]}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-2 text-sm font-semibold">Kiedy
          <input className="field" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} placeholder="np. 1912, ok. 1930, 2019-05" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold">Tytuł wpisu
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={PLACEHOLDER[type]} required />
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold">Opis i dokumenty
          <textarea rows={3} className="field resize-y py-3 leading-normal" value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Co potwierdza ten wpis: katalog, rachunek, protokół konserwatorski…" />
        </label>
        <p className="m-0 text-[13px] text-muted">Wpisu nie da się później zmienić — dopisze się na końcu łańcucha ze swoim skrótem SHA-256.</p>
        {error && <p className="m-0 rounded-xl bg-alert-tint px-4 py-3 text-sm font-semibold text-alert">{error}</p>}
        <button type="submit" disabled={m.isPending} className="btn-primary min-h-[52px] text-base disabled:opacity-60">
          {m.isPending ? "Zapisuję…" : "Dodaj do rodowodu"}
        </button>
      </form>
    </Modal>
  );
}
