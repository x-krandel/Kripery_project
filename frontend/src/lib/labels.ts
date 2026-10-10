import type { ArtworkCategory, ArtworkStatus, AuctionStatus, PassportEventType, UserRole } from "../api/types";

export const EVENT_LABEL: Record<PassportEventType, string> = {
  creation: "Utworzenie",
  exhibition: "Wystawa",
  conservation: "Konserwacja",
  ownership_change: "Zmiana właściciela",
  registration: "Dodano do Rodowodu",
};

export const CATEGORY_LABEL: Record<ArtworkCategory, string> = {
  painting: "Malarstwo",
  works_on_paper: "Rysunek i grafika",
  sculpture: "Rzeźba",
  other: "Inne",
};

export const STATUS_LABEL: Record<ArtworkStatus, string> = {
  published: "Opublikowane",
  held: "Wstrzymane",
};

export const AUCTION_LABEL: Record<AuctionStatus, string> = {
  scheduled: "Wkrótce",
  live: "Na żywo",
  ended: "Zakończona",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  collector: "kolekcjoner(ka)",
  buyer: "kupujący",
};

/** Polish female first names end in -a (Anna, Ewa); good enough to pick word forms for the demo users. */
export function isFeminine(name: string): boolean {
  return name.endsWith("a");
}

/** Role label in the right Polish gender. */
export function roleLabel(name: string, role: UserRole): string {
  if (role === "collector") return isFeminine(name) ? "kolekcjonerka" : "kolekcjoner";
  return isFeminine(name) ? "kupująca" : "kupujący";
}
