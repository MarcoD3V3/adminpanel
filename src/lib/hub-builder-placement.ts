import type { HubElement, HubLayout, HubScreen } from "@/types/hub-builder";
import type { HubElementClipboard } from "@/lib/hub-builder-clipboard";
import { getClipboardRoot } from "@/lib/hub-builder-clipboard";
import { clampElement, snapToGrid } from "@/lib/hub-builder-data";
import {
  elementAbsolutePosition,
  elementParentInset,
} from "@craftlauncher/shared";

export { elementAbsolutePosition, elementParentInset };

/** Tipos que no pueden contener hijos (nodos lógicos invisibles). */
const NON_NESTABLE_PARENT_TYPES = new Set<HubElement["type"]>([
  "automation-node",
  "show-on-condition",
  "hide-on-condition",
]);

export function isNestableParent(element: HubElement): boolean {
  return element.visible !== false && !NON_NESTABLE_PARENT_TYPES.has(element.type);
}

/** Convierte un punto del canvas (coords absolutas) a coords locales del elemento. */
export function canvasPointToElementLocal(
  elements: HubElement[],
  el: HubElement,
  canvasX: number,
  canvasY: number
): { x: number; y: number } {
  if (!el.parentId) return { x: canvasX, y: canvasY };
  const parent = elements.find((p) => p.id === el.parentId);
  if (!parent) return { x: canvasX, y: canvasY };
  const parentAbs = elementAbsolutePosition(elements, parent.id);
  const pad = elementParentInset(parent);
  return {
    x: canvasX - parentAbs.x - pad,
    y: canvasY - parentAbs.y - pad,
  };
}

export function elementEditorBounds(
  elements: HubElement[],
  el: HubElement,
  canvasW: number,
  canvasH: number
): { width: number; height: number } {
  const parent = el.parentId ? elements.find((p) => p.id === el.parentId) : null;
  const pad = elementParentInset(parent);
  return {
    width: parent ? Math.max(0, parent.width - pad * 2) : canvasW,
    height: parent ? Math.max(0, parent.height - pad * 2) : canvasH,
  };
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.w > b.x &&
    a.y < b.y + b.height &&
    a.y + a.h > b.y
  );
}

/** Saca hijos de padres inválidos (mods-catalog, botones, etc.) al lienzo. */
export function repairInvalidElementParents(elements: HubElement[], grid: number): HubElement[] {
  const byId = new Map(elements.map((e) => [e.id, e] as const));

  return elements.map((el) => {
    if (!el.parentId) return el;
    const parent = byId.get(el.parentId);
    if (parent && isNestableParent(parent)) return el;

    const abs = elementAbsolutePosition(elements, el.id);
    const { parentId: _removed, ...rest } = el;
    return {
      ...rest,
      x: snapToGrid(abs.x, grid),
      y: snapToGrid(abs.y, grid),
    };
  });
}

export function findNestableParentAtPoint(
  elements: HubElement[],
  x: number,
  y: number,
  width: number,
  height: number
): HubElement | null {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const candidates = elements
    .filter((e) => e.visible && isNestableParent(e))
    .sort((a, b) => b.zIndex - a.zIndex);

  for (const c of candidates) {
    const p = elementAbsolutePosition(elements, c.id);
    if (cx >= p.x && cy >= p.y && cx <= p.x + c.width && cy <= p.y + c.height) {
      return c;
    }
  }
  return null;
}

function positionIsFree(
  pos: { x: number; y: number },
  width: number,
  height: number,
  topLevel: HubElement[]
): boolean {
  const hit = { x: pos.x, y: pos.y, w: width, h: height };
  return !topLevel.some((e) =>
    rectsOverlap(hit, { x: e.x, y: e.y, width: e.width, height: e.height })
  );
}

/** Posición libre en el lienzo (evita solapar top-level visibles). */
export function findPaletteSpawnPosition(
  screen: HubScreen,
  width: number,
  height: number,
  grid: number
): { x: number; y: number } {
  const gap = Math.max(grid, 8);
  const topLevel = screen.elements.filter((e) => !e.parentId && e.visible);

  // Misma fila: a la derecha de cada elemento existente
  for (const e of topLevel) {
    const beside = clampElement(
      snapToGrid(e.x + e.width + gap, grid),
      snapToGrid(e.y, grid),
      width,
      height,
      screen.width,
      screen.height
    );
    if (positionIsFree(beside, width, height, topLevel)) return beside;
  }

  // Misma columna: debajo de cada elemento existente
  for (const e of topLevel) {
    const below = clampElement(
      snapToGrid(e.x, grid),
      snapToGrid(e.y + e.height + gap, grid),
      width,
      height,
      screen.width,
      screen.height
    );
    if (positionIsFree(below, width, height, topLevel)) return below;
  }

  // Barrido en cuadrícula (filas y columnas)
  const stepY = grid;
  const stepX = grid;
  for (let y = gap; y + height <= screen.height; y += stepY) {
    for (let x = gap; x + width <= screen.width; x += stepX) {
      const pos = clampElement(
        snapToGrid(x, grid),
        snapToGrid(y, grid),
        width,
        height,
        screen.width,
        screen.height
      );
      if (positionIsFree(pos, width, height, topLevel)) return pos;
    }
  }

  return clampElement(
    screen.width / 2 - width / 2,
    screen.height / 2 - height / 2,
    width,
    height,
    screen.width,
    screen.height
  );
}

export function placeInsideParent(
  parent: HubElement,
  elements: HubElement[],
  rawX: number,
  rawY: number,
  width: number,
  height: number,
  grid: number
): { parentId: string; x: number; y: number } {
  const pAbs = elementAbsolutePosition(elements, parent.id);
  const display = parent.container?.display ?? "absolute";
  const pad = display === "absolute" ? 0 : Math.max(0, Number(parent.container?.padding ?? 0));
  const innerW = Math.max(0, parent.width - pad * 2);
  const innerH = Math.max(0, parent.height - pad * 2);
  const localX = snapToGrid(rawX - pAbs.x - pad, grid);
  const localY = snapToGrid(rawY - pAbs.y - pad, grid);
  const clamped = clampElement(localX, localY, width, height, innerW, innerH);
  return { parentId: parent.id, x: clamped.x, y: clamped.y };
}

export function resolveInsideParentPlacement(opts: {
  parent: HubElement;
  elements: HubElement[];
  width: number;
  height: number;
  grid: number;
}): { parentId: string; x: number; y: number } {
  const { parent, elements, width, height, grid } = opts;
  const siblings = elements.filter((e) => e.parentId === parent.id);
  const display = parent.container?.display ?? "absolute";
  const pad = display === "absolute" ? 0 : Math.max(0, Number(parent.container?.padding ?? 0));
  const innerW = Math.max(0, parent.width - pad * 2);
  const innerH = Math.max(0, parent.height - pad * 2);

  for (const sib of siblings) {
    const beside = clampElement(
      snapToGrid(sib.x + sib.width + grid, grid),
      snapToGrid(sib.y, grid),
      width,
      height,
      innerW,
      innerH
    );
    if (positionIsFree(beside, width, height, siblings)) {
      return { parentId: parent.id, x: beside.x, y: beside.y };
    }
  }

  const stackY = snapToGrid(pad + siblings.length * (height + grid), grid);
  const clamped = clampElement(pad, stackY, width, height, innerW, innerH);
  return { parentId: parent.id, x: clamped.x, y: clamped.y };
}

export function resolvePastePlacement(opts: {
  screen: HubScreen;
  elements: HubElement[];
  clipboard: HubElementClipboard;
  grid: number;
  selectedId?: string | null;
  insideParentId?: string | null;
  atX?: number;
  atY?: number;
}): { x: number; y: number; parentId?: string } {
  const { screen, elements, clipboard, grid, selectedId, insideParentId, atX, atY } = opts;
  const root = getClipboardRoot(clipboard);
  const repaired = repairInvalidElementParents(elements, grid);
  const width = root.width;
  const height = root.height;

  if (atX !== undefined && atY !== undefined) {
    const clamped = clampElement(atX, atY, width, height, screen.width, screen.height);
    return { x: clamped.x, y: clamped.y };
  }

  const targetParentId = insideParentId ?? selectedId ?? null;
  const targetParent = targetParentId ? repaired.find((e) => e.id === targetParentId) ?? null : null;
  if (targetParent && isNestableParent(targetParent)) {
    return resolveInsideParentPlacement({
      parent: targetParent,
      elements: repaired,
      width,
      height,
      grid,
    });
  }

  const clipInLayout = repaired.find((e) => e.id === root.id);
  let absX = root.x;
  let absY = root.y;
  if (root.parentId) {
    const source = clipInLayout ?? root;
    const abs = elementAbsolutePosition(
      clipInLayout ? repaired : [...repaired, root],
      source.id
    );
    absX = abs.x;
    absY = abs.y;
  }

  const clamped = clampElement(absX + 16, absY + 16, width, height, screen.width, screen.height);
  return { x: clamped.x, y: clamped.y };
}

export type AddPlacementMode = "palette" | "canvas";

export function resolveNewElementPlacement(opts: {
  mode: AddPlacementMode;
  screen: HubScreen;
  elements: HubElement[];
  width: number;
  height: number;
  grid: number;
  rawX: number;
  rawY: number;
  selectedId: string | null;
}): { x: number; y: number; parentId?: string } {
  const { mode, screen, elements, width, height, grid, rawX, rawY, selectedId } = opts;
  const repaired = repairInvalidElementParents(elements, grid);

  const selected = selectedId ? repaired.find((e) => e.id === selectedId) ?? null : null;

  if (mode === "palette" && selected && isNestableParent(selected)) {
    return resolveInsideParentPlacement({
      parent: selected,
      elements: repaired,
      width,
      height,
      grid,
    });
  }

  if (mode === "canvas") {
    const clamped = clampElement(rawX, rawY, width, height, screen.width, screen.height);
    const parent = findNestableParentAtPoint(repaired, clamped.x, clamped.y, width, height);
    if (parent) {
      const inside = placeInsideParent(parent, repaired, clamped.x, clamped.y, width, height, grid);
      return inside;
    }
    return { x: clamped.x, y: clamped.y };
  }

  const spawn = findPaletteSpawnPosition(screen, width, height, grid);
  return { x: spawn.x, y: spawn.y };
}

export function repairLayoutElementParents(layout: HubLayout, grid = 8): HubLayout {
  const screens = layout.screens.map((screen) => {
    const fixed = repairInvalidElementParents(screen.elements, grid);
    const changed = fixed.some((el, i) => {
      const prev = screen.elements[i];
      return (
        !prev ||
        el.parentId !== prev.parentId ||
        el.x !== prev.x ||
        el.y !== prev.y
      );
    });
    return changed ? { ...screen, elements: fixed } : screen;
  });
  const layoutChanged = screens.some((s, i) => s !== layout.screens[i]);
  return layoutChanged ? { ...layout, screens } : layout;
}
