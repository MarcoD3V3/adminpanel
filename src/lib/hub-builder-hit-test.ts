import type { HubElement } from "@/types/hub-builder";
import { isChatOverlayHubElement, isChatPanelContainer } from "@craftlauncher/shared";

export type HubElementBounds = (el: HubElement) => {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Elementos que se pintan como capa propia en el canvas (no piezas embebidas del launch-panel). */
export function canvasLayerElements(
  elements: HubElement[],
  opts?: { editorChatPreview?: boolean }
): HubElement[] {
  const byId = new Map(elements.map((e) => [e.id, e] as const));
  return elements.filter((el) => {
    const chatPart = isChatOverlayHubElement(el) || isChatPanelContainer(el);
    const chatBubble = el.type === "chat-bubble-toggle";

    if (chatPart && !opts?.editorChatPreview) return false;
    if (!chatBubble && !el.visible && !(opts?.editorChatPreview && chatPart)) return false;

    if (!el.parentId) return true;
    const parent = byId.get(el.parentId);
    if (!parent) return true;
    if (parent.type === "launch-panel") return false;
    if (isChatPanelContainer(parent)) return false;
    return true;
  });
}

/** Profundidad de anidamiento (0 = raíz del canvas). */
export function elementNestDepth(elements: HubElement[], el: HubElement): number {
  const byId = new Map(elements.map((e) => [e.id, e] as const));
  let depth = 0;
  let current: HubElement | undefined = el;
  const seen = new Set<string>();
  while (current?.parentId && !seen.has(current.parentId)) {
    seen.add(current.parentId);
    depth += 1;
    current = byId.get(current.parentId);
  }
  return depth;
}

/** z-index efectivo en el editor: hijos siempre encima de sus padres. */
export function resolveEditorCanvasZIndex(elements: HubElement[], el: HubElement): number {
  return elementNestDepth(elements, el) * 10000 + (el.zIndex ?? 0);
}

/**
 * Devuelve el elemento bajo el punto del canvas.
 * Prioriza el área más pequeña (elemento interior) y desempata por zIndex.
 */
export function hitTestHubElementAtPoint(
  elements: HubElement[],
  cx: number,
  cy: number,
  bounds: HubElementBounds
): HubElement | null {
  const hits: HubElement[] = [];

  for (const el of elements) {
    if (!el.visible || el.locked) continue;
    const { x, y, width, height } = bounds(el);
    if (cx >= x && cx <= x + width && cy >= y && cy <= y + height) {
      hits.push(el);
    }
  }

  if (hits.length === 0) return null;

  hits.sort((a, b) => {
    const areaA = a.width * a.height;
    const areaB = b.width * b.height;
    if (areaA !== areaB) return areaA - areaB;
    const depthA = elementNestDepth(elements, a);
    const depthB = elementNestDepth(elements, b);
    if (depthA !== depthB) return depthB - depthA;
    return b.zIndex - a.zIndex;
  });

  return hits[0] ?? null;
}

function sortHitsByTargetPriority(elements: HubElement[], hits: HubElement[]): HubElement | null {
  if (hits.length === 0) return null;
  hits.sort((a, b) => {
    const areaA = a.width * a.height;
    const areaB = b.width * b.height;
    if (areaA !== areaB) return areaA - areaB;
    const depthA = elementNestDepth(elements, a);
    const depthB = elementNestDepth(elements, b);
    if (depthA !== depthB) return depthB - depthA;
    return b.zIndex - a.zIndex;
  });
  return hits[0] ?? null;
}

/** Hit-test alineado al DOM (respeta zoom, pan y transform del canvas). */
export function hitTestHubElementFromPointer(
  elements: HubElement[],
  clientX: number,
  clientY: number
): HubElement | null {
  if (typeof document === "undefined") return null;

  const byId = new Map(elements.map((e) => [e.id, e] as const));
  const hits: HubElement[] = [];

  for (const node of document.elementsFromPoint(clientX, clientY)) {
    if (!(node instanceof Element)) continue;
    const wrapper = node.closest("[data-hub-el][data-element-id]");
    if (!wrapper) continue;
    const id = wrapper.getAttribute("data-element-id");
    if (!id) continue;
    const el = byId.get(id);
    if (!el || !el.visible || el.locked) continue;
    if (!hits.some((h) => h.id === el.id)) hits.push(el);
  }

  return sortHitsByTargetPriority(elements, hits);
}
