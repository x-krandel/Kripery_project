import { createContext } from "react";
import { setApiUser } from "../api/client";
import type { UserDto } from "../api/types";

export const STORAGE_KEY = "rodowod.userId";
const DEFAULT_USER_ID = 2; // Piotr, a buyer: can bid right away

export function readStoredId(): number {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY));
    return [1, 2, 3].includes(v) ? v : DEFAULT_USER_ID;
  } catch {
    return DEFAULT_USER_ID;
  }
}

export interface CurrentUserValue {
  users: UserDto[];
  user: UserDto | null;
  userId: number;
  setUserId: (id: number) => void;
}

export const CurrentUserContext = createContext<CurrentUserValue | null>(null);

// Set before the first request so every call carries X-User-Id.
setApiUser(readStoredId());
