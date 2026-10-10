// In-browser mock of the whole API (VITE_USE_MOCKS=true).
// Same demo data and the same rules as the backend stub, so switching to the real API
// changes nothing on screen. Lets the frontend work before the backend is ready.

import { ApiRequestError, getApiToken } from "./client";
import type {
  AiDescribeRequest, AiDescriptionDto, AuthResponse, LoginRequest, RegisterRequest, ArtworkCategory, ArtworkDetailDto, ArtworkSummaryDto,
  AuctionDetailDto, AuctionStatus, AuctionSummaryDto, AuctionWsMessage, BidDto, CreateArtworkRequest,
  CreateAuctionRequest, LostArtworkDto, LostArtworkMatchDto, NewPassportEventRequest,
  PassportDto, PassportEventDto, PassportEventType, PlaceBidRequest, UploadDto, UserDto,
} from "./types";
import type { Api, AuctionListener } from "./endpoints";

// ---------- helpers ----------
const iso = (d: Date): string => d.toISOString().replace(/\.\d{3}Z$/, "Z");
const now = () => new Date(Math.floor(Date.now() / 1000) * 1000);
const minutes = (n: number) => n * 60_000;
const delay = <T,>(value: T, ms = 250 + Math.random() * 200): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));
const fail = (status: number, code: string, message: string): never => {
  throw new ApiRequestError(status, code, message);
};
const formatPln = (n: number) =>
  new Intl.NumberFormat("pl-PL", { useGrouping: "always" } as Intl.NumberFormatOptions).format(n) + " zł";

// Deterministic 64-hex hash (display + tamper demo only; the real chain is SHA-256 on the backend).
function hash64(input: string): string {
  let out = "";
  for (let seed = 1; out.length < 64; seed++) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < input.length; i++) {
      const ch = input.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    out += (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
  }
  return out.slice(0, 64);
}
const GENESIS = "0".repeat(64);

// ---------- state ----------
interface MArtwork {
  id: number; ownerId: number; title: string; artist: string; dating: string; technique: string;
  category: ArtworkCategory; dimensions: string; story: string; imageUrl: string;
  status: "published" | "held"; lossResult: "clear" | "match"; lossTop: number; lossCheckedAt: string;
  lossMatches: LostArtworkMatchDto[];
}
interface MEvent {
  id: number; artworkId: number; seq: number; type: PassportEventType; occurredOn: string; title: string;
  description: string; createdAt: string; prevHash: string; hash: string;
}
interface MAuction {
  id: number; artworkId: number; status: AuctionStatus; startPrice: number; minStep: number;
  currentPrice: number; startsAt: string; endsAt: string; leaderId: number | null; bidCount: number;
}
interface MBid { id: number; auctionId: number; userId: number; amount: number; createdAt: string }

const users: UserDto[] = [
  { id: 1, name: "Anna", role: "collector" },
  { id: 2, name: "Piotr", role: "buyer" },
  { id: 3, name: "Ewa", role: "buyer" },
];
// Same demo accounts as backend/scripts/seed.py. Mock passwords are plain text: mocks never leave the browser.
const accounts = new Map<string, { userId: number; password: string }>([
  ["anna", { userId: 1, password: "demo1234" }],
  ["piotr", { userId: 2, password: "demo1234" }],
  ["ewa", { userId: 3, password: "demo1234" }],
]);
const lost: LostArtworkDto[] = [
  { id: 1, title: "Portret młodzieńca", artist: "Rafael Santi", sourceUrl: "https://dzielautracone.gov.pl/artykuly/100-portret-mlodzienca-losy-zaginionego-obrazu", imageUrl: "/demo/lost-portrait.svg" },
];
const artworks = new Map<number, MArtwork>();
const events: MEvent[] = [];
const auctions = new Map<number, MAuction>();
const bids: MBid[] = [];
const uploads = new Map<string, { imageUrl: string; name: string }>();
const ids = { artwork: 1, event: 1, auction: 1, bid: 1 };

const REG_CLEAR = "Automatyczne porównanie z bazą strat wojennych MKiDN: brak dopasowań.";
const REG_MATCH = "Automatyczne porównanie z bazą strat wojennych MKiDN: możliwe dopasowanie, publikacja wstrzymana.";

function payload(e: MEvent): string {
  return JSON.stringify([e.artworkId, e.seq, e.type, e.occurredOn, e.title, e.description, e.createdAt]);
}

function appendEvent(artworkId: number, type: PassportEventType, occurredOn: string, title: string,
                     description: string, createdAt = iso(now())): MEvent {
  const chain = events.filter((e) => e.artworkId === artworkId).sort((a, b) => a.seq - b.seq);
  const prev = chain.at(-1);
  const e: MEvent = {
    id: ids.event++, artworkId, seq: prev ? prev.seq + 1 : 1, type, occurredOn, title, description,
    createdAt, prevHash: prev ? prev.hash : GENESIS, hash: "",
  };
  e.hash = hash64(e.prevHash + "|" + payload(e));
  events.push(e);
  return e;
}

function seed(): void {
  const t = iso(new Date(Date.now() - 86_400_000));
  const works: Array<[string, string, string, string, ArtworkCategory, string, string, string]> = [
    ["Portret damy w czerni", "Szkoła polska", "ok. 1895", "olej na płótnie", "painting", "64 × 48 cm", "portrait",
      "Obraz wisiał w salonie mojej prababci w Krakowie. Po wojnie przyjechał z rodziną do Wrocławia, owinięty w koc, razem z albumem zdjęć."],
    ["Widok na Odrę", "Szkoła wrocławska", "ok. 1910", "olej na desce", "painting", "38 × 52 cm", "city",
      "Kupiony na pchlim targu przy Hali Targowej w latach 90."],
    ["Pejzaż jesienny", "Szkoła polska", "ok. 1880", "olej na płótnie", "painting", "72 × 90 cm", "landscape",
      "Pamiątka rodzinna, przez lata wisiała w dworku pod Kaliszem."],
    ["Martwa natura z dzbanem", "Malarz nieznany", "XIX w.", "olej na płótnie", "painting", "46 × 38 cm", "still",
      "Obraz z kolekcji dziadka, sygnatura nieczytelna."],
    ["Kamienice przy rynku", "Szkoła polska", "ok. 1925", "gwasz na papierze", "works_on_paper", "30 × 42 cm", "townhouses",
      "Gwasz kupiony w antykwariacie w Krakowie w 2004 roku."],
    ["Studium głowy kobiety", "Krąg akademicki", "ok. 1900", "węgiel na papierze", "works_on_paper", "48 × 36 cm", "head-study",
      "Rysunek z teki studenckiej, przechowywany w passe-partout."],
    ["Owoce na cynowym talerzu", "Malarz nieznany", "ok. 1870", "olej na płótnie", "painting", "40 × 50 cm", "fruit-plate",
      "Obraz odziedziczony po ciotce z Lwowa."],
    ["Łąka przed burzą", "Szkoła polska", "ok. 1905", "olej na tekturze", "painting", "33 × 41 cm", "storm-meadow",
      "Mały format, malowany prawdopodobnie w plenerze."],
  ];
  for (const [title, artist, dating, technique, category, dimensions, image, story] of works) {
    const id = ids.artwork++;
    artworks.set(id, {
      id, ownerId: 1, title, artist, dating, technique, category, dimensions, story,
      imageUrl: `/demo/${image}.svg`, status: "published", lossResult: "clear", lossTop: 0.31,
      lossCheckedAt: t, lossMatches: [],
    });
  }
  appendEvent(1, "creation", "1895", "Obraz powstaje w Krakowie", "Sygnatura i data na odwrocie płótna. Zdjęcie odwrocia w załączniku.", t);
  appendEvent(1, "exhibition", "1912", "Wystawa salonowa w Krakowie", "Wzmianka w katalogu wystawy. Skan strony katalogu w załączniku.", t);
  appendEvent(1, "ownership_change", "1968", "Zakup do kolekcji rodzinnej", "Odręczny rachunek sprzedaży. Obraz trafia do rodziny obecnej właścicielki.", t);
  appendEvent(1, "conservation", "2019", "Oczyszczenie werniksu i dublowanie płótna", "Protokół konserwatorski (PDF) z opisem zakresu prac.", t);
  appendEvent(1, "registration", "2026", "Wpis Anny K. i weryfikacja", REG_CLEAR, t);
  for (let id = 2; id <= 8; id++) {
    const a = artworks.get(id)!;
    appendEvent(id, "creation", a.dating, "Powstanie dzieła", `${a.technique[0].toUpperCase()}${a.technique.slice(1)}, ${a.dimensions}.`, t);
    appendEvent(id, "registration", "2026", "Dodano do Rodowodu", REG_CLEAR, t);
  }

  const plan: Array<[number, number, number, number, number | null]> = [
    [1, 12000, 100, 18200, 30], [2, 6000, 100, 9400, 120], [3, 15000, 200, 22600, 75], [4, 4000, 100, 4000, null],
    [5, 2000, 100, 3100, 240], [6, 1500, 50, 2450, 360], [7, 5800, 100, 5800, null], [8, 5000, 100, 7900, 1440],
  ];
  const n = Date.now();
  for (const [artworkId, start, step, current, mins] of plan) {
    const id = ids.auction++;
    const scheduled = mins === null;
    const a: MAuction = {
      id, artworkId, status: scheduled ? "scheduled" : "live", startPrice: start, minStep: step, currentPrice: start,
      startsAt: iso(new Date(scheduled ? n + 86_400_000 : n - 3_600_000)),
      endsAt: iso(new Date(scheduled ? n + 86_400_000 + minutes(120) : n + minutes(mins))),
      leaderId: null, bidCount: 0,
    };
    auctions.set(id, a);
    if (!scheduled && current > start) {
      const amounts = [...new Set([3, 2, 1, 0].map((i) => current - i * step * 4).filter((x) => x >= start))];
      amounts.forEach((amount, i) => {
        const userId = i % 2 === 0 ? 2 : 3;
        bids.push({ id: ids.bid++, auctionId: id, userId, amount, createdAt: iso(new Date(n - minutes(amounts.length - i))) });
        a.currentPrice = amount; a.leaderId = userId; a.bidCount++;
      });
    }
  }
}

// ---------- mappers ----------
const userById = (id: number) => users.find((u) => u.id === id)!;
const eventsOf = (artworkId: number) => events.filter((e) => e.artworkId === artworkId).sort((a, b) => a.seq - b.seq);
const activeAuctionOf = (artworkId: number) =>
  [...auctions.values()].find((a) => a.artworkId === artworkId && a.status !== "ended") ?? null;

function verify(artworkId: number) {
  let expected = GENESIS;
  let brokenAt: number | null = null;
  const validBySeq = new Map<number, boolean>();
  for (const e of eventsOf(artworkId)) {
    const ok = e.prevHash === expected && hash64(e.prevHash + "|" + payload(e)) === e.hash;
    validBySeq.set(e.seq, ok);
    if (!ok && brokenAt === null) brokenAt = e.seq;
    expected = e.hash;
  }
  return { validBySeq, chainValid: brokenAt === null, brokenAtSeq: brokenAt };
}

function auctionSummary(a: MAuction): AuctionSummaryDto {
  return { id: a.id, status: a.status, startPrice: a.startPrice, currentPrice: a.currentPrice,
    bidCount: a.bidCount, startsAt: a.startsAt, endsAt: a.endsAt };
}
function bidDto(b: MBid): BidDto {
  return { id: b.id, auctionId: b.auctionId, user: userById(b.userId), amount: b.amount, createdAt: b.createdAt };
}
function auctionDetail(a: MAuction): AuctionDetailDto {
  return {
    ...auctionSummary(a), artworkId: a.artworkId, minStep: a.minStep,
    leader: a.leaderId ? userById(a.leaderId) : null,
    bids: bids.filter((b) => b.auctionId === a.id).sort((x, y) => y.id - x.id).slice(0, 10).map(bidDto),
  };
}
function artworkSummary(a: MArtwork): ArtworkSummaryDto {
  const active = activeAuctionOf(a.id);
  return {
    id: a.id, title: a.title, artist: a.artist, dating: a.dating, technique: a.technique, category: a.category,
    imageUrl: a.imageUrl, status: a.status, ownerId: a.ownerId,
    verified: a.lossResult === "clear" && verify(a.id).chainValid,
    auction: active ? auctionSummary(active) : null,
  };
}
function artworkDetail(a: MArtwork): ArtworkDetailDto {
  return {
    ...artworkSummary(a), dimensions: a.dimensions, story: a.story, owner: userById(a.ownerId),
    lossCheck: { result: a.lossResult, checkedAt: a.lossCheckedAt, topSimilarity: a.lossTop, matches: a.lossMatches },
  };
}
function eventDto(e: MEvent, valid: boolean): PassportEventDto {
  return { id: e.id, seq: e.seq, type: e.type, occurredOn: e.occurredOn, title: e.title, description: e.description,
    createdAt: e.createdAt, prevHash: e.prevHash, hash: e.hash, valid };
}

// ---------- realtime ----------
const listeners = new Map<number, Set<AuctionListener>>();
function emit(auctionId: number, msg: AuctionWsMessage): void {
  listeners.get(auctionId)?.forEach((l) => l(structuredClone(msg)));
}

function requireUser(): UserDto {
  // Mock tokens are "mock-<userId>", so a login survives a page reload (mock state is rebuilt on load).
  const token = getApiToken();
  const id = token?.startsWith("mock-") ? Number(token.slice(5)) : undefined;
  const u = id == null ? undefined : users.find((x) => x.id === id);
  return u ?? fail(401, "NO_USER", "Zaloguj się, aby kontynuować");
}

function issue(userId: number): AuthResponse {
  return { token: `mock-${userId}`, user: userById(userId) };
}
function getArtworkOr404(id: number): MArtwork {
  return artworks.get(id) ?? fail(404, "NOT_FOUND", "Nie znaleziono dzieła.");
}

function placeBidSync(auctionId: number, userId: number, amount: number): BidDto {
  const a = auctions.get(auctionId) ?? fail(404, "NOT_FOUND", "Nie znaleziono aukcji.");
  if (a.status !== "live") fail(409, "AUCTION_NOT_LIVE", "Aukcja nie trwa.");
  if (artworks.get(a.artworkId)!.ownerId === userId) fail(403, "OWN_AUCTION", "Nie możesz licytować własnego dzieła.");
  const minimum = a.bidCount > 0 ? a.currentPrice + a.minStep : a.startPrice;
  if (amount < minimum) fail(409, "BID_TOO_LOW", `Minimalna oferta to ${formatPln(minimum)}`);
  const b: MBid = { id: ids.bid++, auctionId, userId, amount, createdAt: iso(now()) };
  bids.push(b);
  a.currentPrice = amount; a.leaderId = userId; a.bidCount++;
  if (new Date(a.endsAt).getTime() - Date.now() < 30_000) a.endsAt = iso(new Date(new Date(a.endsAt).getTime() + 30_000));
  const dto = bidDto(b);
  emit(auctionId, { type: "bid", bid: dto, currentPrice: a.currentPrice, bidCount: a.bidCount, endsAt: a.endsAt });
  return dto;
}

// A rival bidder keeps the demo lively: sometimes Ewa answers a bid a few seconds later.
function maybeRivalBid(auctionId: number, bidderId: number): void {
  if (bidderId === 3 || Math.random() > 0.45) return;
  setTimeout(() => {
    const a = auctions.get(auctionId);
    if (!a || a.status !== "live" || a.leaderId === 3 || artworks.get(a.artworkId)!.ownerId === 3) return;
    try { placeBidSync(auctionId, 3, a.currentPrice + a.minStep); } catch { /* ignore */ }
  }, 3500);
}

const startClock = () => setInterval(() => {
  const t = Date.now();
  for (const a of auctions.values()) {
    if (a.status === "scheduled" && new Date(a.startsAt).getTime() <= t) {
      a.status = "live";
      emit(a.id, { type: "snapshot", auction: auctionDetail(a) });
    } else if (a.status === "live" && new Date(a.endsAt).getTime() <= t) {
      a.status = "ended";
      const winner = a.leaderId ? userById(a.leaderId) : null;
      if (winner) {
        const art = artworks.get(a.artworkId)!;
        art.ownerId = winner.id;
        appendEvent(art.id, "ownership_change", iso(now()).slice(0, 10), "Sprzedaż na aukcji Rodowód",
          `Nowy właściciel: ${winner.name}. Cena: ${formatPln(a.currentPrice)}.`);
      }
      emit(a.id, { type: "ended", winner, finalPrice: a.currentPrice });
    }
  }
}, 1000);

// ---------- the mock API ----------
export function createMockApi(): Api {
  seed();
  startClock();
  installDevHelper();
  return mockApi;
}

const mockApi: Api = {
  async register(req: RegisterRequest): Promise<AuthResponse> {
    const username = req.username.trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) fail(400, "INVALID_USERNAME", "Login: 3–32 znaki, małe litery, cyfry oraz . _ -");
    if (req.password.length < 6) fail(400, "WEAK_PASSWORD", "Hasło musi mieć co najmniej 6 znaków");
    if (accounts.has(username)) fail(409, "USERNAME_TAKEN", "Ten login jest już zajęty");
    const id = Math.max(...users.map((u) => u.id)) + 1;
    users.push({ id, name: username, role: "collector" });
    accounts.set(username, { userId: id, password: req.password });
    return delay(issue(id), 400);
  },

  async login(req: LoginRequest): Promise<AuthResponse> {
    const acc = accounts.get(req.username.trim().toLowerCase());
    if (!acc || acc.password !== req.password) fail(401, "INVALID_CREDENTIALS", "Nieprawidłowy login lub hasło");
    return delay(issue(acc!.userId), 300);
  },

  me: () => delay(requireUser()),

  async logout(): Promise<void> {
    await delay(null, 100);
  },

  listUsers: () => delay(users),

  async upload(file: File): Promise<UploadDto> {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) fail(415, "UNSUPPORTED_FILE", "Dozwolone są pliki JPG, PNG lub WebP.");
    if (file.size > 10 * 1024 * 1024) fail(413, "FILE_TOO_LARGE", "Plik jest większy niż 10 MB.");
    const uploadId = crypto.randomUUID();
    const imageUrl = URL.createObjectURL(file);
    uploads.set(uploadId, { imageUrl, name: file.name });
    return delay({ uploadId, imageUrl }, 500);
  },

  async describe(req: AiDescribeRequest): Promise<AiDescriptionDto> {
    if (!uploads.has(req.uploadId)) fail(404, "NOT_FOUND", "Nie znaleziono zdjęcia.");
    return delay<AiDescriptionDto>({
      title: "Portret damy w czerni", artist: "Szkoła polska", dating: "ok. 1895", technique: "olej na płótnie",
      category: "painting", aiFields: ["title", "artist", "dating", "technique", "category"],
      note: "AI nie rozpoznało sygnatury. Wpisz autora, jeśli go znasz.",
    }, 1400);
  },

  listArtworks: (ownerId?: number) => {
    const items = [...artworks.values()].filter((a) => (ownerId == null ? a.status === "published" : a.ownerId === ownerId));
    return delay(items.map(artworkSummary));
  },

  async createArtwork(req: CreateArtworkRequest): Promise<ArtworkDetailDto> {
    const user = requireUser();
    const up = uploads.get(req.uploadId) ?? fail(404, "NOT_FOUND", "Nie znaleziono zdjęcia.");
    const isMatch = up.name.toLowerCase().startsWith("lost");
    const id = ids.artwork++;
    const art: MArtwork = {
      id, ownerId: user.id, title: req.title, artist: req.artist, dating: req.dating, technique: req.technique,
      category: req.category, dimensions: req.dimensions, story: req.story, imageUrl: up.imageUrl,
      status: isMatch ? "held" : "published", lossResult: isMatch ? "match" : "clear", lossTop: isMatch ? 0.91 : 0.31,
      lossCheckedAt: iso(now()),
      lossMatches: isMatch ? [{ lostArtworkId: 1, title: lost[0].title, artist: lost[0].artist, sourceUrl: lost[0].sourceUrl, imageUrl: lost[0].imageUrl, similarity: 0.91 }] : [],
    };
    artworks.set(id, art);
    req.history.forEach((h) => appendEvent(id, h.type, h.occurredOn, h.title, h.description));
    appendEvent(id, "registration", String(new Date().getFullYear()), `Wpis: ${user.name}`, isMatch ? REG_MATCH : REG_CLEAR);
    return delay(artworkDetail(art), 1200);
  },

  getArtwork: (id: number) => delay(artworkDetail(getArtworkOr404(id))),

  getPassport(id: number): Promise<PassportDto> {
    const art = getArtworkOr404(id);
    const check = verify(id);
    return delay({
      artwork: artworkSummary(art),
      events: eventsOf(id).map((e) => eventDto(e, check.validBySeq.get(e.seq) ?? false)),
      chainValid: check.chainValid, brokenAtSeq: check.brokenAtSeq, verifiedAt: iso(now()),
    });
  },

  async addEvent(id: number, req: NewPassportEventRequest): Promise<PassportEventDto> {
    const user = requireUser();
    const art = getArtworkOr404(id);
    if (art.ownerId !== user.id) fail(403, "NOT_OWNER", "To nie jest Twoje dzieło.");
    return delay(eventDto(appendEvent(id, req.type, req.occurredOn, req.title, req.description), true));
  },

  async createAuction(req: CreateAuctionRequest): Promise<AuctionDetailDto> {
    const user = requireUser();
    const art = getArtworkOr404(req.artworkId);
    if (art.ownerId !== user.id) fail(403, "NOT_OWNER", "To nie jest Twoje dzieło.");
    if (art.status === "held") fail(409, "ARTWORK_HELD", "Dzieło czeka na weryfikację pochodzenia.");
    if (activeAuctionOf(art.id)) fail(409, "AUCTION_EXISTS", "To dzieło ma już aktywną aukcję.");
    const t = now();
    const a: MAuction = {
      id: ids.auction++, artworkId: art.id, status: "live", startPrice: req.startPrice, minStep: req.minStep,
      currentPrice: req.startPrice, startsAt: iso(t), endsAt: iso(new Date(t.getTime() + minutes(req.durationMinutes))),
      leaderId: null, bidCount: 0,
    };
    auctions.set(a.id, a);
    return delay(auctionDetail(a));
  },

  getAuction: (id: number) => delay(auctionDetail(auctions.get(id) ?? fail(404, "NOT_FOUND", "Nie znaleziono aukcji."))),

  async placeBid(id: number, req: PlaceBidRequest): Promise<BidDto> {
    const user = requireUser();
    await delay(null, 200);
    const dto = placeBidSync(id, user.id, req.amount);
    maybeRivalBid(id, user.id);
    return structuredClone(dto);
  },

  listLost: (limit = 50) => delay(lost.slice(0, limit)),

  subscribeAuction(id: number, onMessage: AuctionListener): () => void {
    const set = listeners.get(id) ?? new Set<AuctionListener>();
    listeners.set(id, set);
    set.add(onMessage);
    const a = auctions.get(id);
    const timer = setTimeout(() => a && onMessage(structuredClone({ type: "snapshot", auction: auctionDetail(a) } as const)), 150);
    return () => {
      clearTimeout(timer);
      set.delete(onMessage);
    };
  },
};

// Dev helper for the tamper demo in mock mode: window.rodowodMock.tamper(1, 3)
function installDevHelper(): void {
  (window as unknown as { rodowodMock: unknown }).rodowodMock = {
    tamper(artworkId: number, seq = 3) {
      const e = eventsOf(artworkId).find((x) => x.seq === seq);
      if (e) e.description += " (zmienione)";
      return Boolean(e);
    },
  };
}
