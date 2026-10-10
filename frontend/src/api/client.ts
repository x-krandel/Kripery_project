// Thin fetch wrapper: base URL, login token, contract error format.

export const API_URL: string = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
export const USE_MOCKS: boolean = import.meta.env.VITE_USE_MOCKS === "true";

let authToken: string | null = null;

export function setApiToken(token: string | null): void {
  authToken = token;
}

export function getApiToken(): string | null {
  return authToken;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function toError(res: Response): Promise<ApiRequestError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* empty body */
  }
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (detail && typeof detail === "object" && !Array.isArray(detail) && "code" in detail) {
    const d = detail as { code: string; message?: string };
    return new ApiRequestError(res.status, d.code, d.message ?? "Coś poszło nie tak.");
  }
  if (res.status === 422) {
    return new ApiRequestError(422, "VALIDATION", "Sprawdź pola formularza.");
  }
  return new ApiRequestError(res.status, "HTTP_" + res.status, "Coś poszło nie tak. Spróbuj ponownie.");
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiRequestError(0, "NETWORK", "Brak połączenia z serwerem.");
  }
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function wsUrl(path: string): string {
  return API_URL.replace(/^http/, "ws") + "/api" + path;
}

/** Backend serves files under /media; mock and local assets are already absolute paths. */
export function mediaUrl(path: string): string {
  if (!path) return "";
  if (/^(https?:|blob:|data:)/.test(path)) return path;
  return path.startsWith("/media") ? API_URL + path : path;
}
