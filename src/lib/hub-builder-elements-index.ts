import type { HubElement, HubLayout } from "@/types/hub-builder";

export type HubElementSurface = "chrome" | "content";

export type HubElementSearchHit = {
  element: HubElement;
  screenId: string;
  screenName: string;
  surface: HubElementSurface;
  score: number;
};

export type ElementTreeNode = {
  element: HubElement;
  children: ElementTreeNode[];
};

export type LayoutTreeGroup = {
  screenId: string;
  screenName: string;
  contentRoots: ElementTreeNode[];
  chromeRoots: ElementTreeNode[];
};

function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase();
}

function elementSearchHaystack(el: HubElement): string[] {
  return [
    el.id,
    el.label ?? "",
    el.type,
    el.positionClass ?? "",
    el.hubGroup ?? "",
    el.logic?.refId ?? "",
  ].map((v) => v.toLowerCase());
}

function scoreElementMatch(el: HubElement, query: string): number {
  const fields = elementSearchHaystack(el);
  let best = 0;
  for (const field of fields) {
    if (!field) continue;
    if (field === query) best = Math.max(best, 100);
    else if (field.startsWith(query)) best = Math.max(best, 80);
    else if (field.includes(query)) best = Math.max(best, 50);
  }
  return best;
}

function pushHits(
  hits: HubElementSearchHit[],
  elements: HubElement[],
  screenId: string,
  screenName: string,
  surface: HubElementSurface,
  query: string
) {
  for (const element of elements) {
    const score = scoreElementMatch(element, query);
    if (score <= 0) continue;
    hits.push({ element, screenId, screenName, surface, score });
  }
}

export function searchHubElements(layout: HubLayout, rawQuery: string): HubElementSearchHit[] {
  const query = normalizeQuery(rawQuery);
  if (!query) return [];

  const hits: HubElementSearchHit[] = [];

  for (const screen of layout.screens) {
    pushHits(hits, screen.elements, screen.id, screen.name, "content", query);
    pushHits(hits, screen.chrome?.elements ?? [], screen.id, screen.name, "chrome", query);
  }

  const fallbackScreenId = layout.activeScreenId ?? layout.screens[0]?.id ?? "launcher";
  const fallbackScreenName =
    layout.screens.find((s) => s.id === fallbackScreenId)?.name ?? fallbackScreenId;
  pushHits(
    hits,
    layout.launcherChrome?.elements ?? [],
    fallbackScreenId,
    fallbackScreenName,
    "chrome",
    query
  );

  return hits
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const labelA = (a.element.label || a.element.type).toLowerCase();
      const labelB = (b.element.label || b.element.type).toLowerCase();
      return labelA.localeCompare(labelB);
    })
    .filter((hit, index, arr) => {
      const key = `${hit.screenId}:${hit.surface}:${hit.element.id}`;
      return arr.findIndex((h) => `${h.screenId}:${h.surface}:${h.element.id}` === key) === index;
    });
}

export function buildElementForest(elements: HubElement[]): ElementTreeNode[] {
  const byId = new Map(elements.map((el) => [el.id, el] as const));
  const childrenByParent = new Map<string, HubElement[]>();

  for (const el of elements) {
    const parentId = el.parentId;
    if (!parentId || !byId.has(parentId)) continue;
    const bucket = childrenByParent.get(parentId) ?? [];
    bucket.push(el);
    childrenByParent.set(parentId, bucket);
  }

  const toNode = (el: HubElement): ElementTreeNode => ({
    element: el,
    children: (childrenByParent.get(el.id) ?? [])
      .sort((a, b) => a.zIndex - b.zIndex || a.label.localeCompare(b.label))
      .map(toNode),
  });

  return elements
    .filter((el) => !el.parentId || !byId.has(el.parentId))
    .sort((a, b) => a.zIndex - b.zIndex || a.label.localeCompare(b.label))
    .map(toNode);
}

export function buildLayoutElementForest(layout: HubLayout): LayoutTreeGroup[] {
  return layout.screens.map((screen) => buildScreenElementForest(screen));
}

export function buildScreenElementForest(screen: {
  id: string;
  name: string;
  elements: HubElement[];
  chrome?: { elements: HubElement[] };
}): LayoutTreeGroup {
  return {
    screenId: screen.id,
    screenName: screen.name,
    contentRoots: buildElementForest(screen.elements),
    chromeRoots: buildElementForest(screen.chrome?.elements ?? []),
  };
}

export function collectAncestorIds(elements: HubElement[], targetId: string): string[] {
  const byId = new Map(elements.map((el) => [el.id, el] as const));
  const chain: string[] = [];
  let current = byId.get(targetId);
  const seen = new Set<string>();

  while (current?.parentId && !seen.has(current.parentId)) {
    seen.add(current.parentId);
    chain.unshift(current.parentId);
    current = byId.get(current.parentId);
  }

  return chain;
}

export function elementTreeLabel(el: HubElement): string {
  const name = el.label?.trim();
  if (name) return name;
  return el.type;
}

export function surfaceLabel(surface: HubElementSurface): string {
  return surface === "chrome" ? "Barra" : "Contenido";
}
