import type { HubElement, HubScreen } from "@/types/hub-builder";

/** ID lógico: número puro o nombre sin espacios (letras, números, _) */
export const REF_ID_PATTERN = /^(?:[a-zA-Z_][a-zA-Z0-9_]*|\d+)$/;

export function normalizeRefId(input: string): string {
  return input.trim().replace(/\s+/g, "").replace(/[^a-zA-Z0-9_]/g, "");
}

export function isValidRefId(refId: string): boolean {
  if (!refId) return true;
  return REF_ID_PATTERN.test(refId);
}

export function findElementByRef(screen: HubScreen, refId: string): HubElement | null {
  if (!refId) return null;
  return screen.elements.find((el) => el.logic?.refId === refId) ?? null;
}

export function findDuplicateRef(screen: HubScreen, refId: string, excludeElementId?: string): HubElement | null {
  if (!refId) return null;
  return (
    screen.elements.find(
      (el) => el.id !== excludeElementId && el.logic?.refId === refId
    ) ?? null
  );
}

export function parseConstantsJson(raw: string): {
  ok: boolean;
  data?: Record<string, string | number | boolean>;
  error?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, data: {} };
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: "Debe ser un objeto JSON { clave: valor }" };
    }
    const data: Record<string, string | number | boolean> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
        data[key] = val;
      } else {
        return { ok: false, error: `Constante "${key}": solo string, number o boolean` };
      }
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: "JSON inválido" };
  }
}

export function constantsToJson(constants?: Record<string, string | number | boolean>): string {
  if (!constants || Object.keys(constants).length === 0) return "";
  return JSON.stringify(constants, null, 2);
}

export function collectRefIds(screen: HubScreen): { refId: string; label: string; elementId: string }[] {
  return screen.elements
    .filter((el) => el.logic?.refId)
    .map((el) => ({
      refId: el.logic!.refId!,
      label: el.label,
      elementId: el.id,
    }));
}

export function suggestRefId(type: string, existing: string[]): string {
  const base = normalizeRefId(type.replace(/-/g, "_")) || "node";
  if (!existing.includes(base)) return base;
  let i = 2;
  while (existing.includes(`${base}${i}`)) i++;
  return `${base}${i}`;
}
