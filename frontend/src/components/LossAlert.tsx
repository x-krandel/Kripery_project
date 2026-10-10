import { Link } from "react-router-dom";
import { mediaUrl } from "../api/client";
import type { ArtworkDetailDto } from "../api/types";
import { External, ShieldAlert } from "./Icons";

/** The red screen: the uploaded photo matched an object from the war-loss database. */
export function LossAlert({ artwork, onAddDocuments }: { artwork: ArtworkDetailDto; onAddDocuments: () => void }) {
  const match = artwork.lossCheck.matches[0];
  const pct = Math.round((match?.similarity ?? artwork.lossCheck.topSimilarity) * 100);

  return (
    <section aria-labelledby="loss-title" className="mx-auto flex w-full max-w-[440px] flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <span className="inline-flex items-center gap-2 self-start rounded-full bg-alert-tint px-3 py-1.5 text-[13px] font-bold text-alert">
          <ShieldAlert size={16} strokeWidth={2} /> Publikacja wstrzymana
        </span>
        <h2 id="loss-title" className="m-0 font-display text-4xl font-semibold leading-[1.02] text-alert">Możliwa strata wojenna</h2>
        <p className="m-0 text-[15px] leading-normal text-ink-soft">
          To zdjęcie jest bardzo podobne do dzieła z bazy strat wojennych MKiDN. Dzieło nie jest widoczne publicznie, dopóki nie sprawdzimy jego pochodzenia.
        </p>
      </div>

      <div className="grid grid-cols-2 items-end gap-3.5">
        <figure className="m-0 flex flex-col gap-2">
          <div className="-rotate-3 border border-line bg-surface p-2 shadow-[0_12px_24px_-14px_rgba(23,20,15,0.45)]">
            <img src={mediaUrl(artwork.imageUrl)} alt="Twoje zdjęcie" className="aspect-[4/5] w-full object-cover" />
          </div>
          <figcaption className="text-center text-xs font-semibold text-ink-soft">Twoje zdjęcie</figcaption>
        </figure>
        {match && (
          <figure className="m-0 flex flex-col gap-2">
            <div className="border-2 border-alert bg-surface p-[7px]">
              <img src={mediaUrl(match.imageUrl)} alt={`Obiekt z bazy strat wojennych: ${match.title}`} className="aspect-[4/5] w-full object-cover" />
            </div>
            <figcaption className="text-center text-xs font-semibold text-alert">Baza strat wojennych</figcaption>
          </figure>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">Podobieństwo</span>
          <span className="font-mono text-[22px] font-medium text-alert">{pct}%</span>
        </div>
        <div role="img" aria-label={`Podobieństwo ${pct} procent`} className="h-2 overflow-hidden rounded-full bg-[#EADFD9]">
          <div className="h-full rounded-full bg-alert transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {match && (
        <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface px-4 py-3.5">
          <span className="font-display text-[22px] leading-[1.1]">{match.title}</span>
          <span className="text-[13px] text-ink-soft">{match.artist}</span>
          <a href={match.sourceUrl} target="_blank" rel="noreferrer"
            className="mt-1 inline-flex min-h-9 items-center gap-1 self-start text-[13px] font-bold text-accent no-underline">
            Zobacz wpis w bazie strat <External size={14} />
          </a>
        </div>
      )}

      <p className="m-0 text-[13px] leading-normal text-ink-soft">
        Jeśli to pomyłka, dodaj dokumenty pochodzenia. Zgłoszenie sprawdzi ekspert, a dzieło wróci do publikacji po weryfikacji.
      </p>

      <div className="flex flex-col gap-2.5">
        <button type="button" onClick={onAddDocuments} className="btn-dark min-h-[54px] text-base">Dodaj dokumenty pochodzenia</button>
        <Link to="/aukcje" className="btn-quiet min-h-12">Wróć do kolekcji</Link>
      </div>
    </section>
  );
}
