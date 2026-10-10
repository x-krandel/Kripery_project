import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { Skeleton } from "./Skeleton";

/** Pages that need an account send visitors to /logowanie and bring them back afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useCurrentUser();
  const location = useLocation();
  if (status === "loading") {
    return <main className="container-page py-16"><Skeleton className="h-96 w-full" /></main>;
  }
  if (status === "anonymous") {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/logowanie?next=${next}`} replace />;
  }
  return <>{children}</>;
}
