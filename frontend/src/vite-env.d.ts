/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_USE_MOCKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Runtime settings from /env.js (see server.js). */
interface Window {
  __RODOWOD__?: { apiUrl?: string };
}
