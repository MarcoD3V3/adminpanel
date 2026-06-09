export const ADMIN_API_URL =
  import.meta.env.VITE_ADMIN_API_URL?.replace(/\/$/, "") || "http://localhost:3000";

export const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3001/ws";

export const LAUNCHER_ID = `launcher-${crypto.randomUUID().slice(0, 8)}`;
