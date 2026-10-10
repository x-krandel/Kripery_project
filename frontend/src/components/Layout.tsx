import { Link, NavLink, Outlet } from "react-router-dom";
import { Plus } from "./Icons";
import { UserSwitcher } from "./UserSwitcher";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `no-underline transition-colors hover:text-accent ${isActive ? "text-accent underline underline-offset-[6px]" : "text-ink"}`;

export function Logo() {
  return (
    <Link to="/" className="font-display text-[32px] font-semibold italic leading-none text-ink no-underline">
      Rodowód
    </Link>
  );
}

export function Header() {
  return (
    <header className="border-b border-line bg-ground">
      <div className="container-page flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-[18px]">
        <Logo />
        <nav aria-label="Główna nawigacja" className="order-3 flex w-full flex-wrap gap-x-7 gap-y-2 text-[15px] font-medium sm:order-none sm:w-auto">
          <NavLink to="/aukcje" className={navClass}>Aukcje</NavLink>
          <NavLink to="/aukcje?widok=kolekcje" className={() => navClass({ isActive: false })}>Kolekcje</NavLink>
          <Link to="/#szukamy" className="text-ink no-underline hover:text-accent">Szukamy</Link>
          <Link to="/#jak-to-dziala" className="text-ink no-underline hover:text-accent">Jak to działa</Link>
        </nav>
        <div className="flex items-center gap-3">
          <UserSwitcher />
          <Link to="/dodaj" className="btn-dark">
            <Plus size={16} /> <span className="hidden sm:inline">Dodaj dzieło</span><span className="sm:hidden">Dodaj</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="container-page flex flex-wrap justify-between gap-4 py-8 text-sm text-muted">
        <span>
          <span className="font-display text-xl italic text-ink">Rodowód</span> · BEST Hacks 2026 · Code for Culture
        </span>
        <span>Dane o stratach wojennych: Ministerstwo Kultury i Dziedzictwa Narodowego</span>
      </div>
    </footer>
  );
}

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex-1">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}
