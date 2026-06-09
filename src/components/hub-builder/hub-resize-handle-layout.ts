import type { ResizeHandle } from "@/lib/hub-builder-data";

/** Punto en el perímetro de un rectángulo redondeado (esquinas sobre el arco). */
const CORNER_ARC_INSET = 1 - Math.SQRT1_2;

export function clampElementBorderRadius(width: number, height: number, radius: number): number {
  if (!Number.isFinite(radius) || radius <= 0) return 0;
  return Math.min(radius, width / 2, height / 2);
}

export function resizeHandleCenter(
  handle: ResizeHandle,
  width: number,
  height: number,
  borderRadius: number
): { x: number; y: number } {
  const r = clampElementBorderRadius(width, height, borderRadius);
  const inset = r * CORNER_ARC_INSET;

  switch (handle) {
    case "nw":
      return { x: inset, y: inset };
    case "ne":
      return { x: width - inset, y: inset };
    case "se":
      return { x: width - inset, y: height - inset };
    case "sw":
      return { x: inset, y: height - inset };
    case "n":
      return { x: width / 2, y: 0 };
    case "s":
      return { x: width / 2, y: height };
    case "e":
      return { x: width, y: height / 2 };
    case "w":
      return { x: 0, y: height / 2 };
    default:
      return { x: width / 2, y: height / 2 };
  }
}
