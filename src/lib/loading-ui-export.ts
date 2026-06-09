import type { HubLayout, HubElement } from "@/types/hub-builder";
import { designAnchorFromElement, type Anchor } from "@/lib/game-ui-export";

export const GAME_LOADING_SCREEN_ID = "craft-game-loading";
export const GAME_LOADING_W = 480;
export const GAME_LOADING_H = 270;

export type LoadingUiLabel = {
  type: "label";
  text: string;
  anchorX: "left" | "center" | "right";
  anchorY: "top" | "center" | "bottom";
  offsetX: number;
  offsetY: number;
  w: number;
  h: number;
  textColor?: string;
};

export type LoadingUiProgress = {
  enabled: boolean;
  anchorX: "left" | "center" | "right";
  anchorY: "top" | "center" | "bottom";
  offsetX: number;
  offsetY: number;
  widthRatio: number;
  height: number;
  color: string;
  trackColor: string;
};

export type LoadingUi = {
  schema: number;
  backgroundColor: string;
  backgroundImage?: string;
  overlayColor?: string;
  progress: LoadingUiProgress;
  elements: LoadingUiLabel[];
};

const PROGRESS_ID = "cl-progress";

export function defaultLoadingScreenElements(): HubElement[] {
  const cx = (w: number) => Math.round((GAME_LOADING_W - w) / 2);
  return [
    {
      id: "cl-brand",
      type: "text",
      x: cx(200),
      y: 100,
      width: 200,
      height: 16,
      zIndex: 1,
      label: "CraftLauncher",
      action: "none",
      visible: true,
      locked: false,
      style: { textColor: "#c8cad0", fontSize: 10 },
    },
    {
      id: PROGRESS_ID,
      type: "launch-progress-bar",
      x: cx(200),
      y: 146,
      width: 200,
      height: 3,
      zIndex: 2,
      label: "Progreso",
      action: "none",
      visible: true,
      locked: false,
      style: {
        backgroundColor: "#1a1d22",
        textColor: "#6b9e78",
      },
    },
  ];
}

function anchorFromElement(
  el: HubElement,
  designW: number,
  designH: number
): Anchor & { w: number; h: number } {
  const w = Math.max(1, Math.round(el.width));
  const h = Math.max(1, Math.round(el.height));
  return { ...designAnchorFromElement(el), w, h };
}

export function exportLoadingUi(layout: HubLayout): LoadingUi {
  const screen = layout.screens.find((s) => s.id === GAME_LOADING_SCREEN_ID);
  const designW = screen?.width ?? GAME_LOADING_W;
  const designH = screen?.height ?? GAME_LOADING_H;
  const src = screen?.elements ?? [];

  const progressEl = src.find((e) => e.id === PROGRESS_ID || e.type === "launch-progress-bar");
  const pa = progressEl
    ? anchorFromElement(progressEl, designW, designH)
    : {
        anchorX: "center" as const,
        anchorY: "top" as const,
        offsetX: 0,
        offsetY: Math.round(designH * 0.54),
        w: 200,
        h: 3,
      };

  const widthRatio = progressEl
    ? Math.min(1, Math.max(0.1, progressEl.width / designW))
    : 0.42;

  const elements: LoadingUiLabel[] = [];
  for (const el of src) {
    if (el.visible === false) continue;
    if (el.type !== "text") continue;
    if (el.id === PROGRESS_ID) continue;
    const a = anchorFromElement(el, designW, designH);
    elements.push({
      type: "label",
      text: el.label ?? "",
      anchorX: a.anchorX,
      anchorY: a.anchorY,
      offsetX: a.offsetX,
      offsetY: a.offsetY,
      w: a.w,
      h: a.h,
      textColor: el.style?.textColor ?? "#e8eaed",
    });
  }

  return {
    schema: 1,
    backgroundColor: screen?.backgroundColor ?? "#0a0b0d",
    backgroundImage: screen?.backgroundImage ?? "",
    overlayColor: "#00000055",
    progress: {
      enabled: progressEl?.visible !== false,
      anchorX: pa.anchorX,
      anchorY: pa.anchorY,
      offsetX: pa.offsetX,
      offsetY: pa.offsetY,
      widthRatio,
      height: Math.max(2, progressEl?.height ?? 3),
      color: progressEl?.style?.textColor ?? "#6b9e78",
      trackColor: progressEl?.style?.backgroundColor ?? "#1a1d22",
    },
    elements,
  };
}

export function repairLoadingScreen(
  screen: { id: string; width: number; height: number; elements: HubElement[]; independentCanvas?: boolean }
): { width: number; height: number; elements: HubElement[]; independentCanvas: boolean } | null {
  if (screen.id !== GAME_LOADING_SCREEN_ID) return null;
  const needsRepair =
    !screen.independentCanvas ||
    screen.width !== GAME_LOADING_W ||
    screen.height !== GAME_LOADING_H;
  if (!needsRepair) return null;

  const scaleX = screen.width > 0 ? GAME_LOADING_W / screen.width : 1;
  const scaleY = screen.height > 0 ? GAME_LOADING_H / screen.height : 1;
  const elements = screen.elements.map((el) => ({
    ...el,
    x: Math.round(el.x * scaleX),
    y: Math.round(el.y * scaleY),
    width: Math.max(1, Math.round(el.width * scaleX)),
    height: Math.max(1, Math.round(el.height * scaleY)),
  }));

  return { width: GAME_LOADING_W, height: GAME_LOADING_H, elements, independentCanvas: true };
}

export function isLoadingProgressElement(el: HubElement): boolean {
  return el.id === PROGRESS_ID || el.type === "launch-progress-bar";
}

export { PROGRESS_ID as LOADING_PROGRESS_ELEMENT_ID };
