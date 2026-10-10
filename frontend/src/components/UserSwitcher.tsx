import { useEffect, useRef, useState } from "react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { roleLabel } from "../lib/labels";
import { Check, ChevronDown, ShieldAlert } from "./Icons";

const AVATAR: Record<number, string> = { 1: "bg-accent", 2: "bg-[#2F4A3A]", 3: "bg-brass" };

export function Avatar({ id, name, size = 34 }: { id: number; name: string; size?: number }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-full text-sm font-bold text-ground ${AVATAR[id] ?? "bg-ink"}`}>
      {name.charAt(0)}
    </span>
  );
}

/** Demo login: pick one of the three seeded users; stored in localStorage and sent as X-User-Id. */
export function UserSwitcher() {
  const { users, usersLoaded, user, setUserId } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (usersLoaded && users.length === 0) {
    // Backend answered with no users: the database was not seeded, every write would get 401 NO_USER.
    return (
      <span role="status" title="docker compose exec backend python -m scripts.seed --reset"
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-alert-tint px-4 text-sm font-semibold text-alert">
        <ShieldAlert size={16} /> Brak użytkowników demo — uruchom seed
      </span>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        aria-label={user ? `Zmień użytkownika demo, obecnie ${user.name}` : "Wybierz użytkownika demo"}
        className="flex min-h-11 items-center gap-2.5 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-sm font-medium text-ink hover:border-line-strong">
        {user ? <Avatar id={user.id} name={user.name} /> : <span className="h-[34px] w-[34px] rounded-full bg-chip" />}
        <span className="hidden sm:inline">{user ? `${user.name} · ${roleLabel(user.name, user.role)}` : "Użytkownik"}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-[0_20px_40px_-20px_rgba(23,20,15,0.35)]">
          <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Użytkownik demo</p>
          {users.map((u) => (
            <button key={u.id} type="button" role="menuitemradio" aria-checked={u.id === user?.id}
              onClick={() => { setUserId(u.id); setOpen(false); }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-ground">
              <Avatar id={u.id} name={u.name} size={30} />
              <span className="flex-1">
                <span className="block text-sm font-semibold">{u.name}</span>
                <span className="block text-xs text-muted">{roleLabel(u.name, u.role)}</span>
              </span>
              {u.id === user?.id && <Check size={16} className="text-ok" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
