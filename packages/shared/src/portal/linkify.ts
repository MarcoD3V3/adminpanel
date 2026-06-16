/** Segmentos de texto con enlaces detectados para mensajes de chat. */

export type MessageTextSegment =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string };

const URL_RE =
  /(?:https?:\/\/|www\.)[^\s<>"']+/gi;

function normalizeHref(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function parseMessageLinks(text: string): MessageTextSegment[] {
  if (!text) return [{ type: "text", value: "" }];

  const segments: MessageTextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const index = match.index ?? 0;
    if (index > last) {
      segments.push({ type: "text", value: text.slice(last, index) });
    }
    const value = match[0].replace(/[),.!?;:]+$/, "");
    segments.push({ type: "link", value, href: normalizeHref(value) });
    last = index + match[0].length;
  }
  if (last < text.length) {
    segments.push({ type: "text", value: text.slice(last) });
  }
  return segments.length ? segments : [{ type: "text", value: text }];
}

export const CHAT_HUB_ELEMENT_TYPES = [
  "chat-bubble-toggle",
  "chat-header",
  "chat-panel",
  "chat-tabs",
  "chat-input",
  "chat-send",
  "chat-close",
  "chat-resize-handle",
] as const;

export type ChatHubElementType = (typeof CHAT_HUB_ELEMENT_TYPES)[number];

export const CHAT_OVERLAY_ELEMENT_TYPES = new Set<ChatHubElementType>([
  "chat-header",
  "chat-panel",
  "chat-tabs",
  "chat-input",
  "chat-send",
  "chat-close",
  "chat-resize-handle",
]);
