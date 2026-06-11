/// <reference types="vite/client" />

import type { LauncherDesktopApi } from "./lib/electron-api";

interface ImportMetaEnv {
  /** URL del admin en producción (Railway, etc.). Prioridad sobre local. */
  readonly VITE_ADMIN_API_URL?: string;
  /** Admin local si producción no responde. */
  readonly VITE_ADMIN_API_URL_LOCAL?: string;
  /** "true" = priorizar admin local aunque producción responda */
  readonly VITE_ADMIN_API_PREFER_LOCAL?: string;
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    launcher?: LauncherDesktopApi;
  }
}

export {};
