import { createContext } from "react";
import { setApiToken } from "../api/client";
import type { UserDto } from "../api/types";

export const TOKEN_KEY = "rodowod.token";

export function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string | null): void {
  setApiToken(token);
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode: the session lasts until reload */
  }
}

export type AuthStatus = "loading" | "anonymous" | "authenticated";

export interface AuthValue {
  status: AuthStatus;
  user: UserDto | null;
  /** Shortcut for ownership checks; null when nobody is logged in. */
  userId: number | null;
  login: (username: string, password: string) => Promise<UserDto>;
  register: (username: string, password: string) => Promise<UserDto>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthValue | null>(null);

// Set before the first request so a returning visitor's calls already carry the token.
setApiToken(readStoredToken());
