import { createContext } from "react";

export type ToastTone = "ok" | "error";
export type ShowToast = (text: string, tone?: ToastTone) => void;

export const ToastContext = createContext<ShowToast>(() => {});
