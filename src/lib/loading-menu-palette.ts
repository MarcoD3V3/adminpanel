import type { HubElementType, HubElementAction } from "@/types/hub-builder";

export type LoadingPaletteCategory = "loading-text" | "loading-widgets";

export const loadingCategoryLabels: Record<LoadingPaletteCategory, string> = {
  "loading-text": "Texto",
  "loading-widgets": "Widgets",
};

export const LOADING_PALETTE_ORDER: LoadingPaletteCategory[] = [
  "loading-text",
  "loading-widgets",
];

export type LoadingPaletteItem = {
  id: string;
  type: HubElementType;
  label: string;
  description: string;
  category: LoadingPaletteCategory;
  defaultWidth: number;
  defaultHeight: number;
  defaultLabel: string;
  defaultAction: HubElementAction;
};

export const loadingPalette: LoadingPaletteItem[] = [
  {
    id: "loading.text",
    type: "text",
    label: "Texto",
    description: "Marca o mensaje de carga",
    category: "loading-text",
    defaultWidth: 200,
    defaultHeight: 16,
    defaultLabel: "CraftLauncher",
    defaultAction: "none",
  },
  {
    id: "loading.progress",
    type: "launch-progress-bar",
    label: "Barra progreso",
    description: "Barra de carga del juego",
    category: "loading-widgets",
    defaultWidth: 200,
    defaultHeight: 3,
    defaultLabel: "Progreso",
    defaultAction: "none",
  },
];
