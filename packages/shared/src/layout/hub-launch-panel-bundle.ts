import type { HubElement, HubElementType } from "../types/hub-layout";
import { suggestUniqueRefId } from "./hub-element-targets";

/** Piezas del panel de lanzamiento (mismo contenido que LaunchPanelComposite). */
export const LAUNCH_PANEL_PARTS: {
  type: HubElementType;
  refBase: string;
  height: number;
  action?: HubElement["action"];
}[] = [
  { type: "launch-version-title", refBase: "tituloLanzamiento", height: 28 },
  { type: "launch-phase-label", refBase: "faseLanzamiento", height: 24 },
  { type: "launch-detail-text", refBase: "detalleLanzamiento", height: 36 },
  { type: "launch-progress-bar", refBase: "barraProgreso", height: 10 },
  { type: "launch-error-block", refBase: "errorLanzamiento", height: 44 },
  { type: "launch-ok-hint", refBase: "avisoEnJuego", height: 28 },
  { type: "launch-log-panel", refBase: "registroLanzamiento", height: 128 },
  { type: "launch-hint-text", refBase: "hintOcultar", height: 22 },
  { type: "launch-dismiss-button", refBase: "btnOcultarPanel", height: 44, action: "hide-launch-panel" },
];

export const LAUNCH_UI_ELEMENT_TYPES = new Set<HubElementType>([
  "launch-panel",
  ...LAUNCH_PANEL_PARTS.map((p) => p.type),
  "launch-structured-log",
  "launch-desktop-window-toggle",
]);

type BundleOpts = {
  x: number;
  y: number;
  zIndex: number;
  existingRefs: string[];
  panelWidth?: number;
};

/** Crea panel + hijos modulares (no borra el tipo launch-panel). */
export function createLaunchPanelBundle(opts: BundleOpts): HubElement[] {
  const { x, y, zIndex, existingRefs } = opts;
  const panelWidth = opts.panelWidth ?? 400;
  const pad = 20;
  const gap = 10;
  const innerW = panelWidth - pad * 2;

  const refs = [...existingRefs];
  const parentId = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const panelRef = suggestUniqueRefId("panelLanzando", refs);
  refs.push(panelRef);

  let innerY = 0;
  const children: HubElement[] = [];

  for (const part of LAUNCH_PANEL_PARTS) {
    const refId = suggestUniqueRefId(part.refBase, refs);
    refs.push(refId);
    const childId = `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    children.push({
      id: childId,
      type: part.type,
      parentId,
      x: pad,
      y: pad + innerY,
      width: innerW,
      height: part.height,
      zIndex: zIndex + 1,
      label: "",
      action: part.action ?? "none",
      visible: false,
      locked: false,
      style: {
        borderRadius: part.type === "launch-dismiss-button" ? 10 : 0,
        backgroundColor: part.type === "launch-dismiss-button" ? "rgba(255,255,255,0.08)" : undefined,
        textColor: "#e8e9eb",
      },
      hubGroup: "lanzamiento",
      logic: { enabled: false, trigger: "click", script: "", refId },
      css: {},
    });
    innerY += part.height + gap;
  }

  const panelHeight = pad * 2 + innerY - gap;

  const parent: HubElement = {
    id: parentId,
    type: "launch-panel",
    x,
    y,
    width: panelWidth,
    height: panelHeight,
    zIndex,
    label: "Panel lanzamiento",
    action: "none",
    visible: false,
    locked: false,
    style: {
      borderRadius: 16,
      backgroundColor: "#0c0e11",
      textColor: "#e8e9eb",
    },
    hubGroup: "lanzamiento",
    logic: { enabled: false, trigger: "click", script: "", refId: panelRef },
    container: {
      display: "flex",
      direction: "column",
      align: "stretch",
      justify: "start",
      gap,
      padding: pad,
      wrap: false,
    },
    css: {},
  };

  return [parent, ...children];
}
