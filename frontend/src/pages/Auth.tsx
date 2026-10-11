import { useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiRequestError } from "../api/client";
import { Avatar } from "../components/Avatar";
import { ArrowRight, Check } from "../components/Icons";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useToast } from "../hooks/useToast";

const DEMO_PASSWORD = "demo1234";
const DEMO_ACCOUNTS = [
  { id: 1, username: "anna", name: "Anna", role: "kolekcjonerka" },
  { id: 2, username: "piotr", name: "Piotr", role: "kupujący" },
  { id: 3, username: "ewa", name: "Ewa", role: "kupująca" },
];
const USERNAME_RE = /^[a-z0-9_.-]{3,32}$/;

/** Only same-site paths, so ?next= cannot send people to another website. */
function useNext(): string {
  const raw = useSearchParams()[0].get("next") ?? "/";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

function errorText(e: unknown): string {
  return e instanceof ApiRequestError ? e.message : "Coś poszło nie tak. Spróbuj ponownie.";
}

/** What an account gives, each line backed by a feature that exists in the app. */
const BENEFITS = [
  { title: "Indywidualny dobór dzieł", text: "Przy każdym dziele widzisz podobne, dobrane przez AI po samym obrazie, a nie po tytule czy opisie." },
  { title: "Start dla debiutujących artystów", text: "Twój pierwszy obraz od razu dostaje paszport pochodzenia i kod QR, a na profilu zaprosisz kupujących na własną aukcję stacjonarną." },
  { title: "Licytacje na żywo z czatem", text: "Oferty i wiadomości widzą wszyscy w sali w ułamku sekundy, na telefonie i komputerze." },
  { title: "Historia, której nie da się podrobić", text: "Każdy wpis w paszporcie jest spięty skrótem SHA-256 z poprzednim. Zmiana wstecz od razu wychodzi na jaw." },
  { title: "Ochrona przed dziełami z kradzieży", text: "Każde nowe dzieło porównujemy z bazą polskich strat wojennych MKiDN, zanim trafi na aukcję." },
  { title: "AI-katalogowanie", text: "Wgraj zdjęcie, a AI podpowie tytuł, autora, epokę i technikę. Ty tylko sprawdzasz." },
];

function BenefitsAside() {
  return (
    <aside aria-labelledby="benefits-title" className="flex flex-[1_1_380px] flex-col gap-7 rounded-[28px] bg-ink p-8 text-ground sm:p-10">
      <h2 id="benefits-title" className="m-0 font-display text-[36px] font-medium leading-[1.05] sm:text-[44px]">
        Co daje konto w <em className="italic text-[#E8C9A2]">Rodowodzie</em>
      </h2>
      <ul className="m-0 flex list-none flex-col gap-5 p-0">
        {BENEFITS.map((b) => (
          <li key={b.title} className="flex gap-3.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E8C9A2] text-ink"><Check size={16} /></span>
            <span className="flex flex-col gap-1">
              <span className="text-[17px] font-semibold">{b.title}</span>
              <span className="text-[15px] leading-relaxed text-[#B5AC9C]">{b.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function AuthShell({ eyebrow, title, lead, children, aside }: { eyebrow: string; title: string; lead: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <main className="container-page flex flex-wrap items-stretch gap-12 py-12 sm:py-16">
      <section className="flex min-w-0 flex-[1_1_400px] flex-col justify-center gap-8">
        <div className="flex flex-col gap-3">
          <p className="eyebrow m-0">{eyebrow}</p>
          <h1 className="m-0 font-display text-5xl font-medium leading-none sm:text-6xl">{title}</h1>
          <p className="m-0 text-base text-ink-soft">{lead}</p>
        </div>
        <div className="w-full max-w-[440px]">{children}</div>
      </section>
      {aside ?? <aside aria-hidden="true" className="hidden flex-[1_1_380px] flex-col justify-between gap-8 rounded-[28px] bg-ink p-10 text-ground lg:flex">
        <p className="m-0 font-display text-[44px] font-medium leading-[1.05]">
          Każde dzieło ma swój <em className="italic text-[#E8C9A2]">rodowód.</em>
        </p>
        <div className="mx-auto w-full max-w-[300px] -rotate-2 border border-[#3A352D] bg-surface p-5">
          <img src="/demo/landscape.svg" alt="" className="aspect-[4/5] w-full object-cover" />
        </div>
        <p className="m-0 text-sm leading-relaxed text-[#B5AC9C]">
          Konto pozwala licytować, dodawać dzieła do kolekcji i dopisywać wpisy do ich paszportu.
        </p>
      </aside>}
    </main>
  );
}

function Field({ id, label, hint, ...input }: { id: string; label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <input id={id} className="field" {...input} />
      {hint && <span className="text-[13px] text-muted">{hint}</span>}
    </div>
  );
}

export function Login() {
  const { login } = useCurrentUser();
  const navigate = useNavigate();
  const toast = useToast();
  const next = useNext();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (u: string, p: string, demo = false) => {
    setError(null);
    setBusy(true);
    try {
      const user = await login(u, p);
      toast(`Witaj, ${user.name}!`);
      navigate(next, { replace: true });
    } catch (e) {
      setError(demo && e instanceof ApiRequestError && e.code === "INVALID_CREDENTIALS"
        ? "Konta demo nie istnieją w tej bazie. Uruchom seed na backendzie."
        : errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Podaj login i hasło.");
      return;
    }
    void run(username, password);
  };

  return (
    <AuthShell eyebrow="Konto" title="Zaloguj się" lead="Aby licytować i dodawać dzieła do swojej kolekcji.">
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field id="login-username" label="Login" autoComplete="username" autoCapitalize="none" spellCheck={false}
          value={username} onChange={(e) => setUsername(e.target.value)} />
        <Field id="login-password" label="Hasło" type="password" autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" className="m-0 rounded-xl bg-alert-tint px-4 py-3 text-sm font-semibold text-alert">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary min-h-[52px] text-base disabled:opacity-60">
          {busy ? "Logowanie…" : "Zaloguj się"}
        </button>
        <p className="m-0 text-[15px] text-ink-soft">
          Nie masz konta?{" "}
          <Link to={`/rejestracja?next=${encodeURIComponent(next)}`} className="font-semibold text-accent">Załóż konto</Link>
        </p>
      </form>

      <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6">
        <p className="m-0 text-sm text-ink-soft">
          Konta demo do prezentacji · hasło <code className="rounded bg-chip px-1.5 py-0.5 font-mono text-[13px]">{DEMO_PASSWORD}</code>
        </p>
        <div className="flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button key={a.username} type="button" disabled={busy} onClick={() => void run(a.username, DEMO_PASSWORD, true)}
              className="flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface py-1 pl-1 pr-4 text-sm font-medium hover:border-ink disabled:opacity-60">
              <Avatar id={a.id} name={a.name} size={30} />
              {a.name} <span className="text-muted">· {a.role}</span>
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}

export function Register() {
  const { register } = useCurrentUser();
  const navigate = useNavigate();
  const toast = useToast();
  const next = useNext();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const login = username.trim().toLowerCase();
    if (!USERNAME_RE.test(login)) return setError("Login: 3–32 znaki, małe litery, cyfry oraz . _ -");
    if (password.length < 6) return setError("Hasło musi mieć co najmniej 6 znaków.");
    if (password !== repeat) return setError("Hasła nie są takie same.");
    setBusy(true);
    try {
      await register(login, password);
      toast("Konto utworzone. Witaj na Rodowodzie!");
      navigate(next, { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell eyebrow="Nowe konto" title="Załóż konto" lead="Wystarczy login i hasło. Bez e-maila, bez czekania." aside={<BenefitsAside />}>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field id="reg-username" label="Login" autoComplete="username" autoCapitalize="none" spellCheck={false}
          hint="3–32 znaki: małe litery, cyfry oraz . _ -" value={username} onChange={(e) => setUsername(e.target.value)} />
        <Field id="reg-password" label="Hasło" type="password" autoComplete="new-password" hint="Co najmniej 6 znaków."
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <Field id="reg-repeat" label="Powtórz hasło" type="password" autoComplete="new-password"
          value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        {error && <p role="alert" className="m-0 rounded-xl bg-alert-tint px-4 py-3 text-sm font-semibold text-alert">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary min-h-[52px] text-base disabled:opacity-60">
          {busy ? "Tworzę konto…" : <>Załóż konto <ArrowRight size={18} /></>}
        </button>
        <p className="m-0 text-[15px] text-ink-soft">
          Masz już konto?{" "}
          <Link to={`/logowanie?next=${encodeURIComponent(next)}`} className="font-semibold text-accent">Zaloguj się</Link>
        </p>
      </form>
    </AuthShell>
  );
}
