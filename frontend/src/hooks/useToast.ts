import { useContext } from "react";
import { ToastContext, type ShowToast } from "./toastContext";

export const useToast = (): ShowToast => useContext(ToastContext);
