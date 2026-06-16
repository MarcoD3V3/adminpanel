"use client";

import type { CSSProperties } from "react";
import type { HubElement } from "@craftlauncher/shared";
import { CHAT_OPEN_LAYER_Z } from "@craftlauncher/shared";
import { usePortalChatStore } from "@/lib/portal-chat-store";
import { ChatBubbleToggleHub, renderChatHubElement } from "./PortalChatHub";

type LhWrap = (extra?: CSSProperties) => {
  className: string;
  style: React.CSSProperties;
  "data-hub-el": string;
};

export function ChatOverlayAtPosition({ element, lhWrap }: { element: HubElement; lhWrap: LhWrap }) {
  const isOpen = usePortalChatStore((s) => s.isOpen);
  if (!isOpen) return null;

  const frame = lhWrap({
    background: "transparent",
    overflow: "hidden",
    zIndex: Math.max(element.zIndex, CHAT_OPEN_LAYER_Z),
  });

  return (
    <div {...frame} className={[frame.className, "hub-chat-overlay-at-layout"].filter(Boolean).join(" ")}>
      <div className="hub-chat-positioned-part">{renderChatHubElement(element)}</div>
    </div>
  );
}

export function ChatBubbleAtHub({
  element,
  lhWrap,
  cssStyle,
}: {
  element: HubElement;
  lhWrap: LhWrap;
  cssStyle: CSSProperties;
}) {
  const isOpen = usePortalChatStore((s) => s.isOpen);
  const frame = lhWrap({
    background: "transparent",
    ...cssStyle,
    ...(isOpen ? { zIndex: Math.max(element.zIndex, CHAT_OPEN_LAYER_Z) } : {}),
  });

  return (
    <div {...frame} className={[frame.className, isOpen ? "hub-chat-overlay-at-layout" : ""].filter(Boolean).join(" ")}>
      <ChatBubbleToggleHub element={element} />
    </div>
  );
}
