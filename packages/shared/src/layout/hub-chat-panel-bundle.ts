import type { HubElement, HubElementType } from "../types/hub-layout";
import { CHAT_OVERLAY_ELEMENT_TYPES, type ChatHubElementType } from "../portal/linkify";
import { suggestUniqueRefId } from "./hub-element-targets";

export const CHAT_PANEL_REF = "panelChat";

export const CHAT_PANEL_PARTS: {
  type: HubElementType;
  refBase: string;
  height: number;
  width?: number;
  offsetX?: number;
  label?: string;
}[] = [
  { type: "chat-header", refBase: "cabeceraChat", height: 44, label: "Mensajes" },
  { type: "chat-tabs", refBase: "pestanasChat", height: 36, label: "Tabs" },
  { type: "chat-panel", refBase: "historialChat", height: 220, label: "Historial" },
  { type: "chat-input", refBase: "entradaChat", height: 36, label: "Escribe un mensaje…" },
  { type: "chat-send", refBase: "btnEnviarChat", height: 36, width: 64, label: "Enviar" },
  { type: "chat-close", refBase: "btnCerrarChat", height: 32, width: 36, label: "✕" },
  { type: "chat-resize-handle", refBase: "btnRedimensionarChat", height: 32, width: 32, label: "⤢" },
];

export const CHAT_UI_ELEMENT_TYPES = new Set<HubElementType>([
  "chat-bubble-toggle",
  ...CHAT_PANEL_PARTS.map((p) => p.type),
]);

export function isChatPanelContainer(el: HubElement): boolean {
  return (
    el.type === "surface-box" &&
    (el.hubGroup === "chat" || el.logic?.refId === CHAT_PANEL_REF)
  );
}

export function isChatOverlayHubElement(el: HubElement): boolean {
  return CHAT_OVERLAY_ELEMENT_TYPES.has(el.type as ChatHubElementType);
}

export function isChatRuntimeElement(el: HubElement): boolean {
  return (
    el.type === "chat-bubble-toggle" ||
    isChatOverlayHubElement(el) ||
    isChatPanelContainer(el)
  );
}

type BundleOpts = {
  bubbleX: number;
  bubbleY: number;
  zIndex: number;
  existingRefs: string[];
  screenWidth?: number;
  screenHeight?: number;
};

/** Crea burbuja + contenedor surface-box con piezas de chat (editables en el Hub). */
export function createChatPanelBundle(opts: BundleOpts): HubElement[] {
  const { bubbleX, bubbleY, zIndex, existingRefs } = opts;
  const panelWidth = 320;
  const pad = 12;
  const gap = 8;
  const innerW = panelWidth - pad * 2;
  const sendW = 64;
  const inputW = innerW - sendW - gap;

  const refs = [...existingRefs];
  const parentId = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const panelRef = suggestUniqueRefId(CHAT_PANEL_REF, refs);
  refs.push(panelRef);

  const bubbleRef = suggestUniqueRefId("btnBurbujaChat", refs);
  refs.push(bubbleRef);

  let innerY = 0;
  const children: HubElement[] = [];

  const pushChild = (part: (typeof CHAT_PANEL_PARTS)[number], x: number, y: number, w: number, h: number) => {
    const refId = suggestUniqueRefId(part.refBase, refs);
    refs.push(refId);
    const childId = `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const isSend = part.type === "chat-send";
    children.push({
      id: childId,
      type: part.type,
      parentId,
      x,
      y,
      width: w,
      height: h,
      zIndex: zIndex + 1,
      label: part.label ?? "",
      action: "none",
      visible: false,
      locked: false,
      style: {
        borderRadius: isSend ? 10 : 8,
        backgroundColor: isSend ? "#7c83ff" : undefined,
        textColor: isSend ? "#fff" : "#e8ecf4",
      },
      hubGroup: "chat",
      logic: { enabled: false, trigger: "click", script: "", refId },
      css: {},
    });
  };

  for (const part of CHAT_PANEL_PARTS) {
    if (part.type === "chat-send" || part.type === "chat-resize-handle") continue;

    if (part.type === "chat-input") {
      const rowY = pad + innerY;
      pushChild(part, pad, rowY, inputW, part.height);
      const sendPart = CHAT_PANEL_PARTS.find((p) => p.type === "chat-send")!;
      pushChild(sendPart, pad + inputW + gap, rowY, sendW, sendPart.height);
      innerY += part.height + gap;
      continue;
    }

    if (part.type === "chat-close") {
      const rowY = pad + innerY;
      pushChild(part, pad, rowY, 36, part.height);
      const resizePart = CHAT_PANEL_PARTS.find((p) => p.type === "chat-resize-handle")!;
      pushChild(resizePart, pad + innerW - 32, rowY, 32, resizePart.height);
      innerY += part.height + gap;
      continue;
    }

    pushChild(part, pad, pad + innerY, innerW, part.height);
    innerY += part.height + gap;
  }

  const panelHeight = pad * 2 + innerY - gap;
  const panelX = Math.max(12, bubbleX - panelWidth - 16);
  const panelY = Math.max(12, bubbleY - panelHeight + 52);

  const parent: HubElement = {
    id: parentId,
    type: "surface-box",
    x: panelX,
    y: panelY,
    width: panelWidth,
    height: panelHeight,
    zIndex: zIndex,
    label: "Panel chat",
    action: "none",
    visible: false,
    locked: false,
    style: {
      borderRadius: 14,
      backgroundColor: "#0f1116",
      textColor: "#e8ecf4",
    },
    hubGroup: "chat",
    logic: { enabled: false, trigger: "click", script: "", refId: panelRef },
    container: {
      display: "absolute",
      direction: "column",
      align: "stretch",
      justify: "start",
      gap,
      padding: pad,
      wrap: false,
    },
    css: {},
  };

  const bubble: HubElement = {
    id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "chat-bubble-toggle",
    x: bubbleX,
    y: bubbleY,
    width: 52,
    height: 52,
    zIndex: zIndex + 2,
    label: "Chat",
    action: "none",
    visible: true,
    locked: false,
    style: {
      borderRadius: 999,
      backgroundColor: "#7c83ff",
      textColor: "#ffffff",
    },
    hubGroup: "chat",
    logic: { enabled: false, trigger: "click", script: "", refId: bubbleRef },
    css: {},
  };

  return [parent, ...children, bubble];
}
