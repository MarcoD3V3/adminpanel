import type { HubElement, HubLayout } from "../types/hub-layout";

export const HUB_GROUP_PREFIX = "@group:";

export type HubGroupInfo = { group: string; label: string; count: number };

function normalizeGroupName(input: string): string {
  return input.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_.-]/g, "");
}

export function isHubGroupToken(token: string): boolean {
  const t = token.trim();
  return t.startsWith(HUB_GROUP_PREFIX) || t.startsWith("group:");
}

export function hubGroupFromToken(token: string): string {
  const t = token.trim();
  if (t.startsWith(HUB_GROUP_PREFIX)) return t.slice(HUB_GROUP_PREFIX.length);
  if (t.startsWith("group:")) return t.slice("group:".length);
  return t;
}

/** Lista separada por comas (refs o @group:…). */
export function parseTargetList(raw: unknown): string[] {
  const s = String(raw ?? "").trim();
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function joinTargetList(items: string[]): string {
  return items.map((x) => x.trim()).filter(Boolean).join(",");
}

function walkElements(layout: HubLayout): HubElement[] {
  const out: HubElement[] = [];
  for (const screen of layout.screens) {
    out.push(...screen.elements);
    out.push(...(screen.chrome?.elements ?? []));
  }
  out.push(...(layout.launcherChrome?.elements ?? []));
  return out;
}

export function collectHubGroups(layout: HubLayout): HubGroupInfo[] {
  const counts = new Map<string, number>();
  for (const el of walkElements(layout)) {
    const g = normalizeGroupName(el.hubGroup ?? "");
    if (!g) continue;
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([group, count]) => ({ group, label: `${group} (${count})`, count }))
    .sort((a, b) => a.group.localeCompare(b.group));
}

export function hubGroupTargetOptions(groups: HubGroupInfo[]): { value: string; label: string }[] {
  return groups.map((g) => ({
    value: `${HUB_GROUP_PREFIX}${g.group}`,
    label: `Grupo: ${g.label}`,
  }));
}

export function collectAllRefIds(layout: HubLayout): string[] {
  return walkElements(layout)
    .map((e) => e.logic?.refId?.trim())
    .filter((r): r is string => Boolean(r));
}

/** IDs únicos al crear desde paleta (evita presets duplicados como rule.showPanel). */
export function suggestUniqueRefId(type: string, existing: string[]): string {
  const base = type.replace(/-/g, "_").replace(/[^a-zA-Z0-9_]/g, "") || "el";
  if (!existing.includes(base)) return base;
  let i = 2;
  while (existing.includes(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

export function findElementsByRef(layout: HubLayout, refId: string): HubElement[] {
  const id = refId.trim();
  if (!id) return [];
  return walkElements(layout).filter((e) => e.logic?.refId?.trim() === id);
}

export function findElementsByGroup(layout: HubLayout, group: string): HubElement[] {
  const g = normalizeGroupName(group);
  if (!g) return [];
  return walkElements(layout).filter((e) => normalizeGroupName(e.hubGroup ?? "") === g);
}
