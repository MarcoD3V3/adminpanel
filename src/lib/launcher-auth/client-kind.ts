import type { SessionClientKind } from "./types";

const VALID: SessionClientKind[] = ["launcher", "portal", "tester"];

export function parseClientKindHeader(value: string | null | undefined): SessionClientKind | undefined {
  const raw = value?.trim().toLowerCase();
  if (!raw) return undefined;
  return VALID.includes(raw as SessionClientKind) ? (raw as SessionClientKind) : undefined;
}

export function parseClientKindFromRequest(request: Request): SessionClientKind | undefined {
  return parseClientKindHeader(request.headers.get("x-client-kind"));
}

export const SESSION_CLIENT_LABELS: Record<SessionClientKind, string> = {
  launcher: "Launcher",
  portal: "Player Portal (Web)",
  tester: "Modo testeo",
};
