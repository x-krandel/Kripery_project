import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/endpoints";
import { ArtworkFrame } from "../components/ArtworkFrame";
import { ChainPanel, IntegrityBadge } from "../components/Badges";
import { Logo } from "../components/Layout";
import { PassportTimeline } from "../components/PassportTimeline";
import { Skeleton } from "../components/Skeleton";
import { attribution } from "../lib/format";

/** Where the QR on the back of the artwork leads. No login, no auction box. */
export function PublicPassport() {
  const id = Number(useParams().id);
  const { data: p, isError } = useQuery({ queryKey: ["passport", id], queryFn: () => api.getPassport(id) });

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="container-page flex items-center justify-between gap-4 py-[18px]">
          <Logo />
          <span className="text-sm text-muted">Paszport publiczny</span>
        </div>
      </header>
      <main className="container-page flex flex-col gap-12 pb-24 pt-10">
        {isError && <p className="m-0 text-lg">Nie znaleziono paszportu. <Link to="/" className="text-accent">Strona główna</Link></p>}
        {p ? (
          <>
            <section className="flex flex-wrap items-center gap-10">
              <ArtworkFrame src={p.artwork.imageUrl} alt={p.artwork.title} className="w-full max-w-[280px]" />
              <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
                <p className="eyebrow m-0">Rodowód dzieła</p>
                <h1 className="m-0 font-display text-5xl font-medium leading-none">{p.artwork.title}</h1>
                <p className="m-0 text-base text-ink-soft">{attribution(p.artwork)}</p>
                <div className="flex flex-wrap gap-2"><IntegrityBadge chainValid={p.chainValid} /></div>
                <ChainPanel chainValid={p.chainValid} count={p.events.length} brokenAtSeq={p.brokenAtSeq} verifiedAt={p.verifiedAt} />
                <Link to={`/dziela/${p.artwork.id}`} className="font-semibold text-accent">Zobacz dzieło na Rodowodzie →</Link>
              </div>
            </section>
            <PassportTimeline events={p.events} />
          </>
        ) : !isError && <Skeleton className="h-72 w-full" />}
      </main>
    </div>
  );
}
