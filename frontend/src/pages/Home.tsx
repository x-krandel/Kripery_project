import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/endpoints";
import { ArtworkFrame } from "../components/ArtworkFrame";
import { VerifiedPill } from "../components/Badges";
import { CountUp } from "../components/CountUp";
import { ArrowRight, LiveDot, Search, ShieldCheck } from "../components/Icons";
import { LotCard } from "../components/LotCard";
import { LotCardSkeleton } from "../components/Skeleton";

const STEPS = [
  { n: "01", title: "Dodaj dzieło", text: "Wgraj zdjęcie. AI podpowie autora, epokę i technikę, a ty tylko sprawdzasz i poprawiasz." },
  { n: "02", title: "Otrzymaj paszport", text: "Wystawy, konserwacje i zmiany właściciela trafiają do łańcucha wpisów. Każda zmiana wstecz od razu wychodzi na jaw." },
  { n: "03", title: "Sprzedaj bezpiecznie", text: "Licytacja na żywo. Po sprzedaży nowy właściciel sam dopisuje się do historii dzieła." },
];

export function Home() {
  const { data, isLoading } = useQuery({ queryKey: ["artworks"], queryFn: () => api.listArtworks() });
  const live = (data ?? [])
    .filter((a) => a.auction?.status === "live")
    .sort((a, b) => new Date(a.auction!.endsAt).getTime() - new Date(b.auction!.endsAt).getTime())
    .slice(0, 3);
  // Hero = a lot that is live right now, else any verified work.
  const hero = live[0] ?? data?.find((a) => a.verified) ?? data?.[0];

  return (
    <main>
      {/* Hero */}
      <section className="container-page flex flex-wrap items-center gap-x-[72px] gap-y-14 pb-[104px] pt-16 sm:pt-20">
        <div className="flex min-w-0 flex-[1_1_500px] flex-col gap-7">
          <p className="eyebrow m-0">Aukcje sztuki z udokumentowaną historią</p>
          <h1 className="m-0 font-display text-[56px] font-medium leading-[0.96] tracking-[-0.015em] sm:text-[92px]">
            Każde dzieło ma swój <em className="italic text-accent">rodowód.</em>
          </h1>
          <p className="m-0 max-w-[540px] text-[19px] leading-relaxed text-ink-soft">
            Kupuj, sprzedawaj i licytuj sztukę z paszportem pochodzenia, którego nie da się po cichu zmienić. Każde dzieło sprawdzamy w bazie polskich strat wojennych, zanim trafi na aukcję.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/aukcje" className="btn-primary min-h-[52px] px-7 text-base">Zobacz aukcje <ArrowRight /></Link>
            <Link to="/dodaj" className="btn-outline min-h-[52px] px-7 text-base">Dodaj dzieło</Link>
          </div>
          <ul className="m-0 mt-3 flex list-none flex-wrap gap-7 border-t border-line p-0 pt-6 text-sm text-ink-soft">
            <li className="flex items-center gap-2"><ShieldCheck className="text-ok" /> Paszport w łańcuchu SHA-256</li>
            <li className="flex items-center gap-2"><Search className="text-ok" /> Weryfikacja w bazie strat MKiDN</li>
            <li className="flex items-center gap-2"><LiveDot /> Licytacje na żywo</li>
          </ul>
        </div>

        <figure className="m-0 flex min-w-0 flex-[1_1_420px] flex-col items-center gap-5">
          {hero ? (
            <ArtworkFrame src={hero.imageUrl} alt={hero.title} mat="lg" shadow className="w-full max-w-[500px]" />
          ) : (
            <div className="aspect-[4/5] w-full max-w-[500px] animate-pulse border border-line bg-surface" />
          )}
          <figcaption className="flex w-full max-w-[500px] flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="font-display text-[22px] italic">{hero?.title ?? "Pejzaż jesienny"}</span>
              <span className="text-[13px] text-muted">{hero ? `${hero.artist}, ${hero.dating}` : " "}</span>
            </div>
            {hero?.verified && <VerifiedPill />}
          </figcaption>
        </figure>
      </section>

      {/* Lost works counter */}
      <section id="szukamy" className="scroll-mt-4 bg-ink text-ground">
        <div className="container-page flex flex-wrap items-center justify-between gap-14 py-20">
          <p className="m-0 font-display text-[88px] font-medium leading-[0.9] tracking-[-0.02em] sm:text-[136px]">
            <CountUp to={65000} suffix="+" />
          </p>
          <div className="flex max-w-[600px] flex-[1_1_420px] flex-col gap-5">
            <p className="m-0 text-[22px] leading-normal">
              dzieł figuruje w polskiej bazie strat wojennych. Część z nich może dziś trafić na rynek, dlatego każde nowe dzieło na Rodowodzie porównujemy z tą bazą.
            </p>
            <div className="flex flex-wrap items-center gap-6">
              <a href="https://dzielautracone.gov.pl" target="_blank" rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-2 text-base font-semibold text-[#E8C9A2] no-underline hover:text-white">
                Przeglądaj zaginione dzieła <ArrowRight />
              </a>
              <span className="text-[13px] text-[#B5AC9C]">Źródło: baza strat wojennych MKiDN, dzielautracone.gov.pl</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="jak-to-dziala" className="container-page flex scroll-mt-4 flex-col gap-14 pb-24 pt-28">
        <div className="flex max-w-[760px] flex-col gap-4">
          <p className="eyebrow m-0">Jak to działa</p>
          <h2 className="m-0 font-display text-[44px] font-medium leading-[1.02] sm:text-[60px]">
            Od zdjęcia do bezpiecznej sprzedaży w trzech krokach.
          </h2>
        </div>
        <ol className="m-0 flex list-none flex-wrap gap-8 p-0">
          {STEPS.map((s) => (
            <li key={s.n} className="flex min-w-0 flex-[1_1_300px] flex-col gap-3.5 border-t border-ink pt-7">
              <span className="font-display text-5xl leading-none text-accent">{s.n}</span>
              <h3 className="m-0 text-[22px] font-semibold">{s.title}</h3>
              <p className="m-0 text-base leading-relaxed text-ink-soft">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Live auctions */}
      {(isLoading || live.length > 0) && (
        <section className="container-page flex flex-col gap-10 pb-28 pt-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="m-0 font-display text-[52px] font-medium leading-none">Trwające aukcje</h2>
            <Link to="/aukcje" className="inline-flex min-h-11 items-center gap-2 font-semibold text-accent no-underline">
              Wszystkie aukcje <ArrowRight />
            </Link>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading
              ? [0, 1, 2].map((i) => <LotCardSkeleton key={i} />)
              : live.map((a) => <LotCard key={a.id} artwork={a} size="lg" />)}
          </div>
        </section>
      )}
    </main>
  );
}
