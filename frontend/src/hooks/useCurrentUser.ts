import { useContext } from "react";
import { AuthContext, type AuthValue } from "./authContext";

/** The logged-in user and the login / register / logout actions. */
export function useCurrentUser(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useCurrentUser must be used inside AuthProvider");
  return v;
}
