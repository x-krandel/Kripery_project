import { useContext } from "react";
import { CurrentUserContext, type CurrentUserValue } from "./currentUserContext";

export function useCurrentUser(): CurrentUserValue {
  const v = useContext(CurrentUserContext);
  if (!v) throw new Error("useCurrentUser must be used inside CurrentUserProvider");
  return v;
}
