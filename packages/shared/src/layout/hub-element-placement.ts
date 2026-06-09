import type { HubElement } from "../types/hub-layout";

/** Padding interno del contenedor que desplaza el origen de coords locales de los hijos. */
export function elementParentInset(parent: HubElement | null | undefined): number {
  if (!parent) return 0;
  const display = parent.container?.display ?? "absolute";
  return display === "absolute" ? 0 : Math.max(0, Number(parent.container?.padding ?? 0));
}

/** Convierte coords locales (guardadas en el layout) a posición absoluta en el canvas. */
export function elementAbsolutePosition(
  elements: HubElement[],
  id: string
): { x: number; y: number } {
  const byId = new Map(elements.map((e) => [e.id, e] as const));
  const start = byId.get(id);
  if (!start) return { x: 0, y: 0 };

  let x = start.x;
  let y = start.y;
  let p = start.parentId ? byId.get(start.parentId) ?? null : null;
  const seen = new Set<string>();

  while (p) {
    if (seen.has(p.id)) break;
    seen.add(p.id);
    x += p.x + elementParentInset(p);
    y += p.y + elementParentInset(p);
    p = p.parentId ? byId.get(p.parentId) ?? null : null;
  }

  return { x, y };
}
