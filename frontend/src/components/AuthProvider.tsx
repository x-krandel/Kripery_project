import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiRequestError } from "../api/client";
import { api } from "../api/endpoints";
import type { AuthResponse, UserDto } from "../api/types";
import { AuthContext, readStoredToken, storeToken, type AuthStatus } from "../hooks/authContext";

/** Session from POST /auth/login | /auth/register; the token is kept in localStorage. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<UserDto | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() => (readStoredToken() ? "loading" : "anonymous"));

  // Returning visitor: check the stored token once.
  useEffect(() => {
    if (status !== "loading") return;
    let alive = true;
    api.me()
      .then((u) => {
        if (!alive) return;
        setUser(u);
        setStatus("authenticated");
      })
      .catch((e) => {
        if (!alive) return;
        // 401 = token expired or the database was reseeded; network errors also fall back to anonymous.
        if (!(e instanceof ApiRequestError) || e.status === 401) storeToken(null);
        setStatus("anonymous");
      });
    return () => {
      alive = false;
    };
  }, [status]);

  const accept = useCallback(
    (res: AuthResponse) => {
      storeToken(res.token);
      setUser(res.user);
      setStatus("authenticated");
      void qc.invalidateQueries();
      return res.user;
    },
    [qc],
  );

  const login = useCallback((username: string, password: string) => api.login({ username, password }).then(accept), [accept]);
  const register = useCallback((username: string, password: string) => api.register({ username, password }).then(accept), [accept]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* the token is dropped locally anyway */
    }
    storeToken(null);
    setUser(null);
    setStatus("anonymous");
    void qc.invalidateQueries();
  }, [qc]);

  const value = useMemo(
    () => ({ status, user, userId: user?.id ?? null, login, register, logout }),
    [status, user, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
