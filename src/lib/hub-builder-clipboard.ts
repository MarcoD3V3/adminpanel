import type { HubElement } from "@/types/hub-builder";

/** Raíz copiada + todos sus descendientes (para pegar/duplicar en bloque). */
export type HubElementClipboard = {
  rootId: string;
  elements: HubElement[];
};

export function collectElementSubtree(elements: HubElement[], rootId: string): HubElement[] {
  const root = elements.find((e) => e.id === rootId);
  if (!root) return [];

  const byParent = new Map<string, HubElement[]>();
  for (const el of elements) {
    if (!el.parentId) continue;
    const list = byParent.get(el.parentId) ?? [];
    list.push(el);
    byParent.set(el.parentId, list);
  }

  const out: HubElement[] = [];
  const seen = new Set<string>();

  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const el = id === root.id ? root : elements.find((e) => e.id === id);
    if (!el) return;
    out.push(el);
    const kids = (byParent.get(id) ?? []).sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));
    for (const kid of kids) visit(kid.id);
  };

  visit(rootId);
  return out;
}

export function createElementClipboard(
  elements: HubElement[],
  rootId: string
): HubElementClipboard | null {
  const subtree = collectElementSubtree(elements, rootId);
  if (subtree.length === 0) return null;
  return {
    rootId,
    elements: subtree.map((e) => JSON.parse(JSON.stringify(e)) as HubElement),
  };
}

export function getClipboardRoot(clip: HubElementClipboard): HubElement {
  return clip.elements.find((e) => e.id === clip.rootId) ?? clip.elements[0];
}

/** Compatibilidad con portapapeles antiguo (un solo elemento). */
export function normalizeElementClipboard(
  stored: HubElement | HubElementClipboard | null | undefined
): HubElementClipboard | null {
  if (!stored) return null;
  if (
    typeof stored === "object" &&
    "elements" in stored &&
    "rootId" in stored &&
    Array.isArray(stored.elements)
  ) {
    return stored as HubElementClipboard;
  }
  const el = stored as HubElement;
  if (!el.id) return null;
  return {
    rootId: el.id,
    elements: [JSON.parse(JSON.stringify(el)) as HubElement],
  };
}

export function collectSubtreeIds(elements: HubElement[], rootIds: string[]): string[] {
  const out = new Set<string>();
  for (const rootId of rootIds) {
    for (const el of collectElementSubtree(elements, rootId)) {
      out.add(el.id);
    }
  }
  return Array.from(out);
}

export function instantiateClipboardSubtree(
  clip: HubElementClipboard,
  placement: { x: number; y: number; parentId?: string },
  startZIndex: number
): { elements: HubElement[]; rootId: string } {
  const idMap = new Map<string, string>();
  const stamp = Date.now();
  clip.elements.forEach((el, i) => {
    idMap.set(el.id, `el-${stamp}-${i}`);
  });

  let z = startZIndex;
  const pasted = clip.elements.map((el) => {
    z += 1;
    const isRoot = el.id === clip.rootId;
    const cloned = JSON.parse(JSON.stringify(el)) as HubElement;
    cloned.id = idMap.get(el.id)!;
    cloned.zIndex = z;
    if (isRoot) {
      cloned.x = placement.x;
      cloned.y = placement.y;
      cloned.parentId = placement.parentId;
    } else {
      cloned.parentId = el.parentId ? idMap.get(el.parentId) : undefined;
    }
    return cloned;
  });

  const rootId = idMap.get(clip.rootId);
  if (!rootId) {
    throw new Error("clipboard root missing from id map");
  }

  return { elements: pasted, rootId };
}
