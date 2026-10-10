import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { roleLabel } from "../lib/labels";
import { Avatar } from "./Avatar";
import { ChevronDown } from "./Icons";

/** Header: "Zaloguj się" for visitors, a menu with the account for logged-in users. */
export function UserMenu() {
  const { status, user, logout } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (status === "loading") return <span className="h-11 w-36 animate-pulse rounded-full bg-chip" aria-hidden="true" />;

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Link to={`/logowanie?next=${next}`} className="btn-quiet">Zaloguj się</Link>;
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        aria-label={`Konto: ${user.name}`}
        className="flex min-h-11 items-center gap-2.5 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-sm font-medium text-ink hover:border-line-strong">
        <Avatar id={user.id} name={user.name} />
        <span className="hidden max-w-[160px] truncate sm:inline">{user.name}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-[0_20px_40px_-20px_rgba(23,20,15,0.35)]">
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Avatar id={user.id} name={user.name} size={30} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">{user.name}</span>
              <span className="text-xs text-muted">{roleLabel(user.name, user.role)}</span>
            </span>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link role="menuitem" to="/aukcje?widok=kolekcje" onClick={() => setOpen(false)}
            className="flex min-h-11 items-center rounded-xl px-3 text-sm text-ink no-underline hover:bg-ground">Moja kolekcja</Link>
          <Link role="menuitem" to="/dodaj" onClick={() => setOpen(false)}
            className="flex min-h-11 items-center rounded-xl px-3 text-sm text-ink no-underline hover:bg-ground">Dodaj dzieło</Link>
          <button role="menuitem" type="button"
            onClick={() => { setOpen(false); navigate("/"); void logout(); /* leave protected pages first, or RequireAuth bounces to /logowanie */ }}
            className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold text-accent hover:bg-ground">
            Wyloguj
          </button>
        </div>
      )}
    </div>
  );
}
