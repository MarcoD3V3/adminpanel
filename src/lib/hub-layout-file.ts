import type { HubLayout } from "@/types/hub-builder";

function isHubLayout(value: unknown): value is HubLayout {
  if (!value || typeof value !== "object") return false;
  const v = value as HubLayout;
  return (
    typeof v.id === "string" &&
    typeof v.activeScreenId === "string" &&
    Array.isArray(v.screens) &&
    v.screens.length > 0 &&
    v.screens.every(
      (s) =>
        typeof s.id === "string" &&
        typeof s.name === "string" &&
        Array.isArray(s.elements)
    )
  );
}

export function parseHubLayoutJson(raw: string): HubLayout | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isHubLayout(parsed)) return parsed;
    if (
      parsed &&
      typeof parsed === "object" &&
      "layout" in parsed &&
      isHubLayout((parsed as { layout: unknown }).layout)
    ) {
      return (parsed as { layout: HubLayout }).layout;
    }
    return null;
  } catch {
    return null;
  }
}

export function safeHubLayoutFileName(name: string): string | null {
  const base = name.trim().replace(/\.json$/i, "");
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(base)) return null;
  return base;
}
