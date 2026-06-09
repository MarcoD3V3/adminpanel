/// <reference types="vite/client" />

import type { LauncherDesktopApi } from "./lib/electron-api";

interface ImportMetaEnv {
  readonly VITE_ADMIN_API_URL?: string;
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
