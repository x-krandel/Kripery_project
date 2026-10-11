import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { mediaUrl } from "../api/client";
import { api } from "../api/endpoints";
import type { ArtworkSummaryDto, UserDto } from "../api/types";
import { ArtworkFrame } from "../components/ArtworkFrame";
import { LiveChip, VerifiedPill } from "../components/Badges";
import { ArrowRight } from "../components/Icons";
import { Skeleton } from "../components/Skeleton";
import { Avatar } from "../components/Avatar";
import { PostCard } from "../components/PostCard";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { attribution, formatPln, plural } from "../lib/format";
import { roleLabel } from "../lib/labels";

const publicWorks = (xs: ArtworkSummaryDto[] | undefined) => (xs ?? []).filter((a) => a.status === "published");

/** Accounts are people (a first name or a login, one word) or the public-domain gallery ("Galeria klasyków"). */
const isInstitution = (name: string) => name.trim().includes(" ");

/** "Kolekcja Anny" for people; an institution's own name as is. */
function collectionTitle(name: string): string {
  return isInstitution(name) ? name : `Kolekcja ${possessive(name)}`;
}

function possessive(name: string): string {
  // Polish genitive for our demo names: Anna -> Anny, Ewa -> Ewy, Piotr -> Piotra.
  if (name.endsWith("a")) return name.slice(0, -1) + (/[kg]$/.test(name.slice(0, -1)) ? "i" : "y");
  return name + "a";
}

type CollectionSort = "value-desc" | "value-asc" | "size" | "name";
const SORTS: Array<[CollectionSort, string]> = [
  ["value-desc", "Najcenniejsze"],
  ["value-asc", "Najtańsze"],
  ["size", "Najwięcej dzieł"],
  ["name", "Alfabetycznie"],
];

/** A collection's value: the latest auction price of each work (current offer or final price). */
const collectionValue = (works: ArtworkSummaryDto[]) => works.reduce((sum, a) => sum + (a.lastPrice ?? 0), 0);

/** B8: list of private collections. */
export function Collections() {
  const { data: users = [], isLoading: usersLoading } = useQuery({ queryKey: ["users"], queryFn: api.listUsers });
  // One catalog request (shared cache with Home and Catalog), grouped by owner.
  const { data: works, isLoading: worksLoading } = useQuery({ queryKey: ["artworks"], queryFn: () => api.listArtworks() });
  const loading = usersLoading || worksLoading;
  const [params, setParams] = useSearchParams();
  const sort = (SORTS.find(([k]) => k === params.get("sort"))?.[0] ?? "value-desc") as CollectionSort;
  const byOwner = new Map<number, ArtworkSummaryDto[]>();
  for (const a of publicWorks(works)) byOwner.set(a.ownerId, [...(byOwner.get(a.ownerId) ?? []), a]);
  const collections = users
    .map((u) => ({ user: u, works: byOwner.get(u.id) ?? [], value: collectionValue(byOwner.get(u.id) ?? []) }))
    .filter((c) => c.works.length > 0)
    .sort((a, b) =>
      sort === "value-desc" ? b.value - a.value || b.works.length - a.works.length
      : sort === "value-asc" ? a.value - b.value || a.works.length - b.works.length
      : sort === "size" ? b.works.length - a.works.length || b.value - a.value
      : a.user.name.localeCompare(b.user.name, "pl"));

  return (
    <main className="container-page flex flex-col gap-12 pb-28 pt-14">
      <div className="flex max-w-[760px] flex-col gap-4">
        <p className="eyebrow m-0">Kolekcje</p>
        <h1 className="m-0 font-display text-[56px] font-medium leading-none sm:text-[68px]">Prywatne kolekcje jako wystawy.</h1>
        <p className="m-0 text-lg leading-relaxed text-ink-soft">
          Zbiory, których zwykle nikt nie ogląda. Każde dzieło ma tu swój paszport pochodzenia.
        </p>
      </div>

      <div className="-mt-4 flex flex-wrap items-center gap-3">
        <label htmlFor="collection-sort" className="text-sm font-semibold text-ink-soft">Sortuj</label>
        <select id="collection-sort" value={sort}
          onChange={(e) => setParams((p) => { p.set("sort", e.target.value); return p; }, { replace: true })}
          className="min-h-11 rounded-full border border-line-strong bg-surface pl-4 pr-11 text-[15px] font-medium text-ink">
          {SORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {loading
          ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-[420px] w-full" />)
          : collections.map(({ user, works, value }) => <CollectionCard key={user.id} user={user} works={works} value={value} />)}
      </div>

      {!loading && collections.length === 0 && (
        <p className="m-0 rounded-2xl border border-dashed border-line-strong p-12 text-center text-ink-soft">
          Nie ma jeszcze publicznych kolekcji. <Link to="/dodaj" className="font-semibold text-accent">Dodaj pierwsze dzieło</Link>.
        </p>
      )}
    </main>
  );
}

function CollectionCard({ user, works, value }: { user: UserDto; works: ArtworkSummaryDto[]; value: number }) {
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
          <span className="font-display text-[28px] leading-none">{collectionTitle(user.name)}</span>
          <span className="text-sm text-muted">
            {works.length} {plural(works.length, "dzieło", "dzieła", "dzieł")}
            {value > 0 && <> · wartość <strong className="font-semibold text-ink">{formatPln(value)}</strong></>}
          </span>
        </div>
        <ArrowRight className="ml-auto text-accent transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

/** B8: one collection shown as a virtual exhibition. */
export function CollectionPage() {
  const userId = Number(useParams().userId);
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: api.listUsers });
  const owner = users.find((u) => u.id === userId);
  const { data, isLoading } = useQuery({ queryKey: ["artworks", "owner", userId], queryFn: () => api.listArtworks(userId) });
  const works = publicWorks(data);
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "posty" ? "posts" : "works";
  const { userId: me } = useCurrentUser();
  const qc = useQueryClient();
  const postsQ = useQuery({ queryKey: ["posts", "author", userId], queryFn: () => api.listPosts({ authorId: userId }) });
  const delPost = useMutation({ mutationFn: api.deletePost, onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }) });
  const posts = postsQ.data ?? [];
  const setTab = (t: "works" | "posts") => setParams((p) => { if (t === "posts") p.set("tab", "posty"); else p.delete("tab"); return p; }, { replace: true });
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
              {owner ? collectionTitle(owner.name) : "Kolekcja"}
            </h1>
            {owner && (
              <span className="flex items-center gap-2.5 text-[15px] text-ink-soft">
                <Avatar id={owner.id} name={owner.name} size={30} /> {isInstitution(owner.name) ? "Dzieła z domeny publicznej, zdjęcia: Wikimedia Commons" : `${owner.name}, ${roleLabel(owner.name, owner.role)}`}
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

      <div className="container-page pt-8">
        <div role="tablist" aria-label="Zawartość profilu" className="flex gap-2 border-b border-line">
          {([["works", `Dzieła (${works.length})`], ["posts", `Posty (${posts.length})`]] as const).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`-mb-px min-h-12 border-b-2 px-4 text-[15px] font-semibold ${tab === k ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "posts" && (
        <section className="container-page flex flex-col gap-6 pt-10 [&>*]:max-w-[880px]">
          {postsQ.isLoading && <Skeleton className="h-56 w-full" />}
          {posts.map((p) => (
            <PostCard key={p.id} post={p}
              onDelete={p.author.id === me ? () => delPost.mutate(p.id) : undefined} deleting={delPost.isPending && delPost.variables === p.id} />
          ))}
          {!postsQ.isLoading && posts.length === 0 && (
            <p className="m-0 rounded-2xl border border-dashed border-line-strong p-12 text-center text-ink-soft">
              {me === userId ? "Nie masz jeszcze postów. Zaproszenie na aukcję stacjonarną dodasz na stronie swojego dzieła." : "Ten kolekcjoner nie ma jeszcze postów."}
            </p>
          )}
        </section>
      )}

      {tab === "works" && <section className="container-page flex flex-col gap-20 pt-16">
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
      </section>}
    </main>
  );
}
