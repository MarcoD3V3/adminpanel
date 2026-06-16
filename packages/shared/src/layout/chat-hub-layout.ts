import type { HubElement } from "../types/hub-layout";
import { CHAT_OVERLAY_ELEMENT_TYPES, type ChatHubElementType } from "../portal/linkify";

export type ChatOverlayBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const GROUP_PADDING = 8;

export function isChatHubElementType(type: string): boolean {
  return type === "chat-bubble-toggle" || CHAT_OVERLAY_ELEMENT_TYPES.has(type as ChatHubElementType);
}

export function getPositionedChatOverlayElements(elements: HubElement[]): HubElement[] {
  return elements.filter(
    (e) =>
      e.visible !== false &&
      CHAT_OVERLAY_ELEMENT_TYPES.has(e.type as ChatHubElementType) &&
      e.width > 0 &&
      e.height > 0
  );
}

export function hasPositionedChatLayout(elements: HubElement[]): boolean {
  return getPositionedChatOverlayElements(elements).length > 0;
}

export function computeChatOverlayBounds(
  elements: HubElement[],
  padding = GROUP_PADDING
): ChatOverlayBounds | null {
  const overlay = getPositionedChatOverlayElements(elements);
  if (!overlay.length) return null;

  const minX = Math.min(...overlay.map((e) => e.x));
  const minY = Math.min(...overlay.map((e) => e.y));
  const maxX = Math.max(...overlay.map((e) => e.x + e.width));
  const maxY = Math.max(...overlay.map((e) => e.y + e.height));

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

/** z-index mínimo para capa de chat abierto sobre el backdrop. */
export const CHAT_OPEN_LAYER_Z = 9010;
