import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { setApiUser } from "../api/client";
import { api } from "../api/endpoints";
import type { UserDto } from "../api/types";

const STORAGE_KEY = "rodowod.userId";
const DEFAULT_USER_ID = 2; // Piotr, a buyer: can bid right away

function readStoredId(): number {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY));
    return [1, 2, 3].includes(v) ? v : DEFAULT_USER_ID;
  } catch {
    return DEFAULT_USER_ID;
  }
}

interface CurrentUserValue {
  users: UserDto[];
  user: UserDto | null;
  userId: number;
  setUserId: (id: number) => void;
}

const Ctx = createContext<CurrentUserValue | null>(null);

// Set before the first request so every call carries X-User-Id.
setApiUser(readStoredId());

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserIdState] = useState<number>(readStoredId);
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: api.listUsers, staleTime: Infinity });

  const setUserId = useCallback((id: number) => {
    setApiUser(id);
    setUserIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, String(id));
    } catch {
      /* private mode */
    }
  }, []);

  const value = useMemo(
    () => ({ users, userId, user: users.find((u) => u.id === userId) ?? null, setUserId }),
    [users, userId, setUserId],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCurrentUser(): CurrentUserValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCurrentUser must be used inside CurrentUserProvider");
  return v;
}
