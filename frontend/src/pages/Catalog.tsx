import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/endpoints";
import type { ArtworkSummaryDto } from "../api/types";
import { ShieldCheck, Search } from "../components/Icons";
import { LotCard } from "../components/LotCard";
import { LotCardSkeleton } from "../components/Skeleton";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { plural } from "../lib/format";

type Filter = "all" | "painting" | "works_on_paper" | "live";
type Sort = "ending" | "price" | "newest";

const CHIPS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Wszystkie" },
  { id: "painting", label: "Malarstwo" },
  { id: "works_on_paper", label: "Rysunek i grafika" },
  { id: "live", label: "Na żywo" },
];

const endsAt = (a: ArtworkSummaryDto) => (a.auction ? new Date(a.auction.endsAt).getTime() : Infinity);
const price = (a: ArtworkSummaryDto) => a.auction?.currentPrice ?? 0;

export function Catalog() {
  const [params, setParams] = useSearchParams();
  const view = params.get("widok") === "kolekcje" ? "collection" : "auctions";
  const { userId, user, status } = useCurrentUser();
  const needsLogin = view === "collection" && status === "anonymous";
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("ending");
  const [q, setQ] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: view === "collection" ? ["artworks", "owner", userId] : ["artworks"],
    queryFn: () => api.listArtworks(view === "collection" ? (userId ?? undefined) : undefined),
    enabled: view === "auctions" || userId != null,
  });

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const items = (data ?? []).filter((a) => {
      if (view === "auctions" && !a.auction) return false;
      if (filter === "painting" && a.category !== "painting") return false;
      if (filter === "works_on_paper" && a.category !== "works_on_paper") return false;
      if (filter === "live" && a.auction?.status !== "live") return false;
      return !needle || `${a.title} ${a.artist} ${a.dating}`.toLowerCase().includes(needle);
    });
    const sorted = [...items];
    if (sort === "ending") sorted.sort((a, b) => endsAt(a) - endsAt(b));
    if (sort === "price") sorted.sort((a, b) => price(b) - price(a));
    if (sort === "newest") sorted.sort((a, b) => b.id - a.id);
    return sorted;
  }, [data, filter, sort, q, view]);

  return (
    <main className="container-page flex flex-col gap-9 pb-28 pt-14">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-3">
          <h1 className="m-0 font-display text-[56px] font-medium leading-none sm:text-[68px]">
            {view === "collection" ? "Moja kolekcja" : "Aukcje"}
          </h1>
          <p className="m-0 text-base text-ink-soft">
            {view === "collection"
              ? `Dzieła użytkownika ${user?.name ?? ""}, także te czekające na weryfikację`
              : `${visible.length} ${plural(visible.length, "lot", "loty", "lotów")} · licytacje kończą się co kilka godzin`}
          </p>
        </div>
        {view === "auctions" && (
          // Only true for the public catalog: "Moja kolekcja" may contain held works.
          <p className="m-0 inline-flex max-w-[460px] items-center gap-2.5 rounded-xl bg-ok-tint px-4 py-3 text-sm font-semibold leading-snug text-ok">
            <ShieldCheck size={20} className="shrink-0" />
            Każdy lot przeszedł automatyczną weryfikację w bazie strat wojennych MKiDN.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Widok">
        <button role="tab" aria-selected={view === "auctions"} onClick={() => setParams({})}
          className={`btn text-sm ${view === "auctions" ? "bg-accent text-white" : "btn-quiet"}`}>Aukcje</button>
        <button role="tab" aria-selected={view === "collection"} onClick={() => setParams({ widok: "kolekcje" })}
          className={`btn text-sm ${view === "collection" ? "bg-accent text-white" : "btn-quiet"}`}>Moja kolekcja</button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-y border-line py-4">
        <div role="group" aria-label="Filtruj loty" className="flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <button key={c.id} type="button" aria-pressed={filter === c.id} onClick={() => setFilter(c.id)}
              className={`btn min-h-11 px-[18px] text-sm ${filter === c.id ? "border border-ink bg-ink text-ground" : "btn-quiet"}`}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-3.5">
            <Search size={16} className="text-muted" />
            <span className="sr-only">Szukaj dzieła</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tytuł, autor, epoka"
              className="w-[200px] border-none bg-transparent text-[15px] text-ink outline-none" />
          </label>
          <label htmlFor="sortuj" className="text-sm text-ink-soft">Sortuj</label>
          <select id="sortuj" value={sort} onChange={(e) => setSort(e.target.value as Sort)}
            className="min-h-11 rounded-full border border-line-strong bg-surface pl-4 pr-11 text-[15px] text-ink">
            <option value="ending">Kończą się najwcześniej</option>
            <option value="price">Najwyższa oferta</option>
            <option value="newest">Najnowsze</option>
          </select>
        </div>
      </div>

      {needsLogin && (
        <p className="m-0 rounded-2xl border border-dashed border-line-strong p-12 text-center text-base text-ink-soft">
          Zaloguj się, aby zobaczyć swoją kolekcję.{" "}
          <Link to="/logowanie?next=%2Faukcje%3Fwidok%3Dkolekcje" className="font-semibold text-accent">Zaloguj się</Link>
          {" "}albo <Link to="/rejestracja?next=%2Fdodaj" className="font-semibold text-accent">załóż konto</Link>.
        </p>
      )}

      {isError && <p className="m-0 rounded-2xl bg-alert-tint p-6 text-alert">Nie udało się wczytać lotów. Sprawdź, czy backend działa.</p>}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-x-7 gap-y-10">
        {isLoading ? Array.from({ length: 8 }, (_, i) => <LotCardSkeleton key={i} />) : visible.map((a) => (
          <div key={a.id} className="relative">
            <LotCard artwork={a} />
            {a.status === "held" && (
              <span className="absolute right-7 top-7 rounded-full bg-alert-tint px-2.5 py-1 text-xs font-bold uppercase tracking-[0.06em] text-alert">Wstrzymane</span>
            )}
          </div>
        ))}
      </div>

      {!needsLogin && !isLoading && !isError && visible.length === 0 && (
        <p className="m-0 rounded-2xl border border-dashed border-line-strong p-12 text-center text-base text-ink-soft">
          Brak lotów w tej kategorii. Wybierz „Wszystkie” albo <Link to="/dodaj" className="font-semibold text-accent">dodaj własne dzieło</Link>.
        </p>
      )}
    </main>
  );
}
