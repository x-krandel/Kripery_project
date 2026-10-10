import { useEffect } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AddArtwork } from "./pages/AddArtwork";
import { ArtworkPage } from "./pages/ArtworkPage";
import { AuctionLive } from "./pages/AuctionLive";
import { Catalog } from "./pages/Catalog";
import { Home } from "./pages/Home";
import { PublicPassport } from "./pages/PublicPassport";

/** Scroll to #hash targets (header links) and to the top on page change. */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function NotFound() {
  return (
    <main className="container-page flex flex-col gap-4 py-24">
      <h1 className="m-0 font-display text-6xl font-medium">Nie ma takiej strony</h1>
      <Link to="/" className="font-semibold text-accent">Wróć na stronę główną</Link>
    </main>
  );
}

export default function App() {
  return (
    <>
      <ScrollManager />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/aukcje" element={<Catalog />} />
          <Route path="/dziela/:id" element={<ArtworkPage />} />
          <Route path="/dodaj" element={<AddArtwork />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="/dziela/:id/aukcja" element={<AuctionLive />} />
        <Route path="/p/:id" element={<PublicPassport />} />
      </Routes>
    </>
  );
}
