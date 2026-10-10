import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { useDropzone } from "react-dropzone";
import { Link, useNavigate } from "react-router-dom";
import { ApiRequestError, mediaUrl } from "../api/client";
import { api } from "../api/endpoints";
import type { AiDescriptionDto, ArtworkCategory, ArtworkDetailDto, UploadDto } from "../api/types";
import { AiChip } from "../components/Badges";
import { Search, Sparkle, Upload } from "../components/Icons";
import { LossAlert } from "../components/LossAlert";
import { Skeleton } from "../components/Skeleton";
import { StepIndicator } from "../components/StepIndicator";
import { useToast } from "../hooks/useToast";
import { plural } from "../lib/format";
import { CATEGORY_LABEL } from "../lib/labels";

type AiKey = AiDescriptionDto["aiFields"][number];

const fileSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;

interface Form {
  title: string;
  artist: string;
  dating: string;
  technique: string;
  category: ArtworkCategory;
  dimensions: string;
  story: string;
}

const EMPTY: Form = { title: "", artist: "", dating: "", technique: "", category: "painting", dimensions: "", story: "" };

export function AddArtwork() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [upload, setUpload] = useState<UploadDto | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [aiFields, setAiFields] = useState<AiKey[]>([]);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [held, setHeld] = useState<ArtworkDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const describe = useMutation({
    mutationFn: (uploadId: string) => api.describe({ uploadId }),
    onSuccess: (d) => {
      setForm((f) => ({ ...f, title: d.title, artist: d.artist, dating: d.dating, technique: d.technique, category: d.category }));
      setAiFields(d.aiFields);
      setAiNote(d.note);
    },
    // AI_UNAVAILABLE: the fields simply stay empty, no error dialog.
  });

  const uploadM = useMutation({
    mutationFn: (f: File) => api.upload(f),
    onSuccess: (u) => {
      setUpload(u);
      describe.mutate(u.uploadId);
    },
    onError: (e) => setError(e instanceof ApiRequestError ? e.message : "Nie udało się wgrać zdjęcia."),
  });

  const create = useMutation({
    mutationFn: () => api.createArtwork({ uploadId: upload!.uploadId, ...form, history: [] }),
    onSuccess: async (art) => {
      await qc.invalidateQueries({ queryKey: ["artworks"] });
      if (art.status === "held") {
        setHeld(art);
      } else {
        toast("Dzieło dodane, rodowód zweryfikowany");
        navigate(`/dziela/${art.id}`);
      }
    },
    onError: (e) => setError(e instanceof ApiRequestError ? e.message : "Nie udało się zapisać dzieła."),
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    onDrop: (accepted, rejected) => {
      setError(null);
      if (rejected.length) {
        setError("Dozwolone są pliki JPG, PNG lub WebP do 10 MB.");
        return;
      }
      const f = accepted[0];
      if (!f) return;
      setFile(f);
      setForm(EMPTY);
      setAiFields([]);
      setAiNote(null);
      uploadM.mutate(f);
    },
  });

  const reset = () => {
    setFile(null); setUpload(null); setForm(EMPTY); setAiFields([]); setAiNote(null); setHeld(null); setError(null);
  };

  const step = held || create.isPending ? 3 : upload ? 2 : 1;
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const aiBusy = describe.isPending;
  const ai = (k: AiKey) => aiFields.includes(k);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) {
      setError("Podaj tytuł dzieła.");
      return;
    }
    create.mutate();
  };

  return (
    <main className="container-page flex flex-col gap-10 pb-24 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2.5">
          <Link to="/aukcje?widok=kolekcje" className="text-sm text-muted no-underline">← Moja kolekcja</Link>
          <h1 className="m-0 font-display text-5xl font-medium leading-none sm:text-6xl">Dodaj dzieło</h1>
        </div>
        <StepIndicator current={step} />
      </div>

      {held ? (
        <LossAlert artwork={held} onAddDocuments={() => navigate(`/dziela/${held.id}?dodaj-wpis=1`)} />
      ) : create.isPending ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-20 text-center">
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-ok-tint text-ok">
            <span className="absolute inset-0 animate-ping rounded-full bg-ok-tint" />
            <Search size={28} className="relative" />
          </span>
          <p className="m-0 font-display text-3xl">Sprawdzamy dzieło w bazie strat wojennych…</p>
          <p className="m-0 text-[15px] text-ink-soft">Porównujemy zdjęcie z obiektami z bazy MKiDN i zakładamy paszport.</p>
        </div>
      ) : !upload ? (
        <div className="flex flex-col gap-4">
          <div {...getRootProps()}
            className={`flex min-h-[360px] cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed p-10 text-center transition-colors ${isDragActive ? "border-accent bg-surface" : "border-line-strong bg-[#FBF9F5] hover:border-ink"}`}>
            <input {...getInputProps()} aria-label="Wybierz zdjęcie dzieła" />
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-ink shadow-sm"><Upload size={28} /></span>
            <p className="m-0 font-display text-3xl">{uploadM.isPending ? "Wgrywam zdjęcie…" : "Przeciągnij zdjęcie dzieła tutaj"}</p>
            <p className="m-0 text-[15px] text-ink-soft">albo kliknij, aby wybrać plik · JPG, PNG lub WebP, do 10 MB</p>
            <p className="m-0 flex items-center gap-2 text-sm text-brass"><Sparkle size={16} /> AI podpowie tytuł, autora, epokę i technikę</p>
          </div>
          {error && <p className="m-0 rounded-xl bg-alert-tint px-4 py-3 text-sm font-semibold text-alert">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-14">
          <div className="flex min-w-0 max-w-[480px] flex-[1_1_380px] flex-col gap-4">
            <div className="border border-line bg-surface p-6">
              <div className="aspect-[4/5] overflow-hidden outline outline-1 outline-line-strong">
                <img src={mediaUrl(upload.imageUrl)} alt="Wgrane zdjęcie dzieła" className="h-full w-full object-cover" />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-ink-soft">{file?.name} · {file ? fileSize(file.size) : ""}</span>
              <button type="button" onClick={reset} className="btn-quiet text-sm">Zmień zdjęcie</button>
            </div>
            <div className="flex items-center gap-3.5 rounded-2xl border border-dashed border-[#BFB5A4] bg-[#FBF9F5] p-[18px]">
              <Upload size={24} className="shrink-0 text-muted" />
              <span className="text-sm leading-snug text-ink-soft">Zdjęcia odwrocia, rachunki i katalogi wzmocnią rodowód. Dodasz je w paszporcie dzieła.</span>
            </div>
          </div>

          <form onSubmit={submit} className="flex min-w-0 flex-[1_1_520px] flex-col gap-[22px]" noValidate>
            <p className="m-0 flex items-start gap-3 rounded-2xl bg-brass-tint px-4.5 py-4 text-[15px] leading-normal text-[#4A3B1E]">
              <Sparkle size={20} className="mt-0.5 shrink-0 text-brass" />
              <span>{aiBusy ? "AI analizuje zdjęcie…" : aiFields.length
                ? `AI wypełniło ${aiFields.length} ${plural(aiFields.length, "pole", "pola", "pól")} na podstawie zdjęcia. Sprawdź je i popraw, jeśli coś się nie zgadza.`
                : "Uzupełnij opis dzieła. Wymagany jest tylko tytuł."}</span>
            </p>

            <Field id="f-title" label="Tytuł" ai={ai("title")} busy={aiBusy}>
              <input id="f-title" className="field" value={form.title} onChange={set("title")} required />
            </Field>
            <Field id="f-artist" label="Autor" ai={ai("artist")} busy={aiBusy} hint={aiNote}>
              <input id="f-artist" className="field" value={form.artist} onChange={set("artist")} />
            </Field>
            <div className="flex flex-wrap gap-4">
              <div className="flex-[1_1_180px]">
                <Field id="f-date" label="Datowanie" ai={ai("dating")} busy={aiBusy}>
                  <input id="f-date" className="field" value={form.dating} onChange={set("dating")} placeholder="np. ok. 1895" />
                </Field>
              </div>
              <div className="flex-[1_1_180px]">
                <Field id="f-tech" label="Technika" ai={ai("technique")} busy={aiBusy}>
                  <input id="f-tech" className="field" value={form.technique} onChange={set("technique")} placeholder="np. olej na płótnie" />
                </Field>
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex-[1_1_180px]">
                <Field id="f-cat" label="Kategoria" ai={ai("category")} busy={aiBusy}>
                  <select id="f-cat" className="field" value={form.category} onChange={set("category")}>
                    {(Object.keys(CATEGORY_LABEL) as ArtworkCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
                  </select>
                </Field>
              </div>
              <div className="flex-[1_1_180px]">
                <Field id="f-dims" label="Wymiary" ai={false} busy={false}>
                  <input id="f-dims" className="field" value={form.dimensions} onChange={set("dimensions")} placeholder="np. 64 × 48 cm" />
                </Field>
              </div>
            </div>
            <Field id="f-story" label="Historia dzieła" ai={false} busy={false}
              hint="Skąd pochodzi dzieło, kto je posiadał, gdzie było pokazywane. Ten tekst zobaczą kupujący.">
              <textarea id="f-story" rows={4} className="field resize-y py-3.5 leading-normal" value={form.story} onChange={set("story")} />
            </Field>

            {error && <p className="m-0 rounded-xl bg-alert-tint px-4 py-3 text-sm font-semibold text-alert">{error}</p>}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button type="submit" disabled={aiBusy} className="btn-primary min-h-[52px] px-[26px] text-base disabled:opacity-60">
                <Search /> Zapisz i sprawdź w bazie strat
              </button>
            </div>
            <p className="m-0 text-[13px] text-muted">Sprawdzenie trwa kilka sekund. Dzieło stanie się widoczne publicznie dopiero po weryfikacji.</p>
          </form>
        </div>
      )}
    </main>
  );
}

function Field({ id, label, ai, busy, hint, children }: {
  id: string; label: string; ai: boolean; busy: boolean; hint?: string | null; children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-[21px] items-center gap-2">
        <label htmlFor={id} className="text-sm font-semibold">{label}</label>
        {ai && !busy && <AiChip />}
      </div>
      {busy ? <Skeleton className="h-12 w-full rounded-xl" /> : children}
      {hint && !busy && <span className="text-[13px] text-muted">{hint}</span>}
    </div>
  );
}
