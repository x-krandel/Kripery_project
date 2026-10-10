import { useQueries, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { mediaUrl } from "../api/client";
import { api } from "../api/endpoints";
import type { ArtworkSummaryDto, UserDto } from "../api/types";
import { ArtworkFrame } from "../components/ArtworkFrame";
import { LiveChip, VerifiedPill } from "../components/Badges";
import { ArrowRight } from "../components/Icons";
import { Skeleton } from "../components/Skeleton";
import { Avatar } from "../components/Avatar";
import { attribution, formatPln, plural } from "../lib/format";
import { roleLabel } from "../lib/labels";

const publicWorks = (xs: ArtworkSummaryDto[] | undefined) => (xs ?? []).filter((a) => a.status === "published");

function possessive(name: string): string {
  // Polish genitive for our demo names: Anna -> Anny, Ewa -> Ewy, Piotr -> Piotra.
  if (name.endsWith("a")) return name.slice(0, -1) + (/[kg]$/.test(name.slice(0, -1)) ? "i" : "y");
  return name + "a";
}

/** B8 — list of private collections. */
export function Collections() {
  const { data: users = [], isLoading: usersLoading } = useQuery({ queryKey: ["users"], queryFn: api.listUsers });
  const queries = useQueries({
    queries: users.map((u) => ({ queryKey: ["artworks", "owner", u.id], queryFn: () => api.listArtworks(u.id) })),
  });
  const loading = usersLoading || queries.some((q) => q.isLoading);
  const collections = users
    .map((u, i) => ({ user: u, works: publicWorks(queries[i]?.data) }))
    .filter((c) => c.works.length > 0);

  return (
    <main className="container-page flex flex-col gap-12 pb-28 pt-14">
      <div className="flex max-w-[760px] flex-col gap-4">
        <p className="eyebrow m-0">Kolekcje</p>
        <h1 className="m-0 font-display text-[56px] font-medium leading-none sm:text-[68px]">Prywatne kolekcje jako wystawy.</h1>
        <p className="m-0 text-lg leading-relaxed text-ink-soft">
          Zbiory, których zwykle nikt nie ogląda. Każde dzieło ma tu swój paszport pochodzenia.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {loading
          ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-[420px] w-full" />)
          : collections.map(({ user, works }) => <CollectionCard key={user.id} user={user} works={works} />)}
      </div>

      {!loading && collections.length === 0 && (
        <p className="m-0 rounded-2xl border border-dashed border-line-strong p-12 text-center text-ink-soft">
          Nie ma jeszcze publicznych kolekcji. <Link to="/dodaj" className="font-semibold text-accent">Dodaj pierwsze dzieło</Link>.
        </p>
      )}
    </main>
  );
}

function CollectionCard({ user, works }: { user: UserDto; works: ArtworkSummaryDto[] }) {
  const cover = works.slice(0, 3);
  return (
    <Link to={`/kolekcje/${user.id}`} className="group flex flex-col gap-5 rounded-3xl border border-line bg-surface p-6 text-ink no-underline transition-shadow hover:shadow-[0_24px_48px_-28px_rgba(23,20,15,0.35)]">
      <div className="grid h-[240px] grid-cols-3 gap-2">
        {cover.map((a, i) => (
          <div key={a.id} className={`overflow-hidden bg-ground outline outline-1 outline-line-strong ${i === 0 ? "col-span-2 row-span-2" : ""}`}>
            <img src={mediaUrl(a.imageUrl)} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Avatar id={user.id} name={user.name} size={40} />
        <div className="flex flex-col">
          <span className="font-display text-[28px] leading-none">Kolekcja {possessive(user.name)}</span>
          <span className="text-sm text-muted">{works.length} {plural(works.length, "dzieło", "dzieła", "dzieł")}</span>
        </div>
        <ArrowRight className="ml-auto text-accent transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

/** B8 — one collection shown as a virtual exhibition. */
export function CollectionPage() {
  const userId = Number(useParams().userId);
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: api.listUsers });
  const owner = users.find((u) => u.id === userId);
  const { data, isLoading } = useQuery({ queryKey: ["artworks", "owner", userId], queryFn: () => api.listArtworks(userId) });
  const works = publicWorks(data);
  const onAuction = works.filter((a) => a.auction?.status === "live").length;
  const verified = works.filter((a) => a.verified).length;

  return (
    <main className="flex flex-col pb-28">
      <section className="border-b border-line">
        <div className="container-page flex flex-wrap items-end justify-between gap-8 pb-12 pt-14">
          <div className="flex flex-col gap-4">
            <Link to="/kolekcje" className="text-sm text-muted no-underline">← Wszystkie kolekcje</Link>
            <p className="eyebrow m-0">Kolekcja prywatna · wystawa online</p>
            <h1 className="m-0 font-display text-[56px] font-medium leading-none sm:text-[80px]">
              {owner ? `Kolekcja ${possessive(owner.name)}` : "Kolekcja"}
            </h1>
            {owner && (
              <span className="flex items-center gap-2.5 text-[15px] text-ink-soft">
                <Avatar id={owner.id} name={owner.name} size={30} /> {owner.name}, {roleLabel(owner.name, owner.role)}
              </span>
            )}
          </div>
          <dl className="m-0 flex gap-10">
            {[[works.length, plural(works.length, "dzieło", "dzieła", "dzieł")], [verified, "z rodowodem"], [onAuction, "na aukcji"]].map(([n, label]) => (
              <div key={String(label)} className="flex flex-col">
                <dt className="order-2 text-sm text-muted">{label}</dt>
                <dd className="m-0 font-display text-5xl leading-none">{n}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="container-page flex flex-col gap-20 pt-16">
        {isLoading && <Skeleton className="h-[480px] w-full" />}
        {works.map((a, i) => (
          <article key={a.id} className={`flex flex-wrap items-center gap-x-16 gap-y-8 ${i % 2 ? "flex-row-reverse" : ""}`}>
            <Link to={`/dziela/${a.id}`} className="block min-w-0 flex-[1_1_380px] max-w-[560px]">
              <ArtworkFrame src={a.imageUrl} alt={a.title} mat="lg" shadow />
            </Link>
            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
              <span className="font-mono text-sm text-muted">{String(i + 1).padStart(2, "0")} / {String(works.length).padStart(2, "0")}</span>
              <h2 className="m-0 font-display text-[44px] font-medium leading-[1.02]">{a.title}</h2>
              <p className="m-0 text-base text-ink-soft">{attribution(a)}</p>
              <div className="flex flex-wrap gap-2">
                {a.verified && <VerifiedPill />}
                {a.auction?.status === "live" && <LiveChip className="border border-line" />}
              </div>
              {a.auction?.status === "live" && (
                <p className="m-0 text-[15px] text-ink-soft">Aktualna oferta: <strong className="text-ink">{formatPln(a.auction.currentPrice)}</strong></p>
              )}
              <Link to={`/dziela/${a.id}`} className="btn-outline self-start">Zobacz rodowód <ArrowRight size={16} /></Link>
            </div>
          </article>
        ))}
        {!isLoading && works.length === 0 && (
          <p className="m-0 rounded-2xl border border-dashed border-line-strong p-12 text-center text-ink-soft">Ta kolekcja nie ma jeszcze publicznych dzieł.</p>
        )}
      </section>
    </main>
  );
}
