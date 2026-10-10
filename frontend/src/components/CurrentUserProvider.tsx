import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { setApiUser } from "../api/client";
import { api } from "../api/endpoints";
import { CurrentUserContext, readStoredId, STORAGE_KEY } from "../hooks/currentUserContext";

/** Demo login: one of the three seeded users, stored in localStorage and sent as X-User-Id. */
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
  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}
