import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/endpoints";
import { ArtworkFrame } from "../components/ArtworkFrame";
import { ArrowLeft, ArrowRight, External, Search, ShieldCheck } from "../components/Icons";
import { LotCardSkeleton } from "../components/Skeleton";
import { plural } from "../lib/format";

const PAGE_SIZE = 50;

/** C5, "Szukamy": war losses from the MKiDN database that the platform watches for. */
export function Lost() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("strona")) || 1);
  const listTop = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["lost", page],
    queryFn: () => api.listLost(PAGE_SIZE, (page - 1) * PAGE_SIZE),
    placeholderData: keepPreviousData,
  });
  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: api.stats });
  const items = data ?? [];
  const total = stats?.lostIndexed ?? items.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Without stats a full page is the only hint that another one follows.
  const hasNext = stats ? page < pages : items.length === PAGE_SIZE;

  const goTo = (p: number) => {
    setParams(p > 1 ? { strona: String(p) } : {});
    listTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main>
      <section className="bg-ink text-ground">
        <div className="container-page flex flex-wrap items-end justify-between gap-10 py-16 sm:py-20">
          <div className="flex max-w-[720px] flex-col gap-5">
            <p className="m-0 text-[13px] font-bold uppercase tracking-[0.16em] text-[#E8C9A2]">Szukamy</p>
            <h1 className="m-0 font-display text-5xl font-medium leading-[0.98] sm:text-[72px]">
              Dzieła, które wciąż nie wróciły do domu.
            </h1>
            <p className="m-0 text-lg leading-relaxed text-[#D9D1C3]">
              To obiekty z bazy strat wojennych MKiDN. Każde zdjęcie dodane na Rodowód porównujemy z nimi automatycznie,
              zanim dzieło trafi na aukcję.
            </p>
          </div>
          <div className="flex flex-col gap-1 text-right">
            <span className="font-display text-6xl leading-none">65 000+</span>
            <span className="text-sm text-[#B5AC9C]">dzieł w bazie MKiDN</span>
          </div>
        </div>
      </section>

      <section className="container-page flex flex-col gap-10 pb-28 pt-14">
        <div ref={listTop} className="flex scroll-mt-24 flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
          <p className="m-0 flex items-center gap-2 text-[15px] text-ink-soft">
            <Search size={18} className="text-accent" />
            {isLoading ? "Wczytuję…" : `${total} ${plural(total, "obiekt", "obiekty", "obiektów")} w naszym indeksie porównawczym`}
          </p>
          <a href="https://dzielautracone.gov.pl" target="_blank" rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-accent no-underline">
            Pełna baza na dzielautracone.gov.pl <External size={15} />
          </a>
        </div>

        {isError && <p className="m-0 rounded-2xl bg-alert-tint p-6 text-alert">Nie udało się wczytać listy. Sprawdź, czy backend działa.</p>}

        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-7 gap-y-10">
          {isLoading
            ? Array.from({ length: 4 }, (_, i) => <LotCardSkeleton key={i} />)
            : items.map((l) => (
              <article key={l.id} className="flex min-w-0 flex-col gap-4">
                <div className="relative">
                  <ArtworkFrame src={l.imageUrl} alt={`${l.title}, ${l.artist}`} className="grayscale-[35%]" />
                  <span className="absolute left-7 top-7 rounded-full bg-surface px-2.5 py-1 text-xs font-bold uppercase tracking-[0.06em] text-alert">
                    Zaginione
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-display text-[25px] leading-[1.1]">{l.title}</span>
                  <span className="text-[13px] text-muted">{l.artist || "Autor nieznany"}</span>
                </div>
                <a href={l.sourceUrl} target="_blank" rel="noreferrer"
                  className="inline-flex min-h-10 items-center gap-1.5 self-start border-t border-line pt-3 text-[13px] font-bold text-accent no-underline">
                  Zobacz wpis w bazie strat <External size={14} />
                </a>
              </article>
            ))}
        </div>

        {!isLoading && (page > 1 || hasNext) && (
          <nav aria-label="Strony indeksu" className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
            <button type="button" onClick={() => goTo(page - 1)} disabled={page <= 1}
              className="btn-quiet min-h-11 px-5 text-sm disabled:invisible">
              <ArrowLeft size={16} /> Poprzednia
            </button>
            <span className="text-sm text-ink-soft">Strona {page}{stats ? ` z ${pages}` : ""}</span>
            <button type="button" onClick={() => goTo(page + 1)} disabled={!hasNext}
              className="btn-quiet min-h-11 px-5 text-sm disabled:invisible">
              Następna <ArrowRight size={16} />
            </button>
          </nav>
        )}

        {!isLoading && !isError && items.length === 0 && page === 1 && (
          <p className="m-0 rounded-2xl border border-dashed border-line-strong p-12 text-center text-ink-soft">
            Indeks jest pusty. Uruchom <code className="font-mono">scripts.index_lost</code> na backendzie.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-6 rounded-3xl bg-surface p-8 sm:p-10">
          <div className="flex max-w-[620px] flex-col gap-3">
            <h2 className="m-0 font-display text-4xl font-medium leading-none">Widziałeś któreś z tych dzieł?</h2>
            <p className="m-0 text-[15px] leading-relaxed text-ink-soft">
              Informacje o miejscu przechowywania zaginionego dzieła przyjmuje Wydział Restytucji Dóbr Kultury MKiDN.
              Na Rodowodzie podobne dzieło zostaje automatycznie wstrzymane przed publikacją.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="https://dzielautracone.gov.pl" target="_blank" rel="noreferrer" className="btn-primary min-h-[52px] px-6 text-base">
              Zgłoś do MKiDN <External size={16} />
            </a>
            <Link to="/dodaj" className="btn-quiet min-h-[52px] px-6 text-base"><ShieldCheck size={18} /> Sprawdź swoje dzieło</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
