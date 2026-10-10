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

/** Role label with the right Polish gender for our three demo users. */
export function roleLabel(name: string, role: UserRole): string {
  if (role === "collector") return name.endsWith("a") ? "kolekcjonerka" : "kolekcjoner";
  return name.endsWith("a") ? "kupująca" : "kupujący";
}
