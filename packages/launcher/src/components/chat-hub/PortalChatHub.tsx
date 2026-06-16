"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HubElement } from "@craftlauncher/shared";
import { hasPositionedChatLayout } from "@craftlauncher/shared";
import { usePortalChatStore } from "@/lib/portal-chat-store";
import { MessageLinkText } from "./MessageLinkText";

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  if (diff < 60_000) return "ahora";
  if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `hace ${Math.floor(diff / 3_600_000)}h`;
  return new Date(iso).toLocaleDateString();
}

function stubElement(type: HubElement["type"], label = ""): HubElement {
  return {
    id: `stub-${type}`,
    type,
    label,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    zIndex: 0,
    locked: false,
    visible: true,
    style: {},
    action: "none",
  };
}

export function ChatBubbleToggleHub({ element }: { element: HubElement }) {
  const isOpen = usePortalChatStore((s) => s.isOpen);
  const incoming = usePortalChatStore((s) => s.chat?.incomingRequestCount ?? 0);

  return (
    <button
      type="button"
      className={`hub-chat-toggle ${isOpen ? "hub-chat-toggle--open" : ""}`}
      onClick={() => usePortalChatStore.getState().toggle()}
      aria-label={isOpen ? "Cerrar chat" : "Abrir chat"}
    >
      <span className="hub-chat-toggle__icon" aria-hidden>
        {isOpen ? "✕" : "💬"}
      </span>
      {!isOpen && incoming > 0 && <span className="hub-chat-toggle__badge">{incoming}</span>}
    </button>
  );
}

export function ChatHeaderHub({ element }: { element: HubElement }) {
  const peer = usePortalChatStore((s) => s.peer);
  const title = peer?.displayName ?? element.label ?? "Mensajes";

  return (
    <div className="hub-chat-header" data-chat-drag-handle>
      <div className="hub-chat-header__text">
        <p className="hub-chat-header__title">{title}</p>
        <p className="hub-chat-header__sub">
          {peer ? (peer.online ? "En línea" : "Fuera de línea") : "Amigos y jugadores activos"}
        </p>
      </div>
    </div>
  );
}

export function ChatTabsHub() {
  const tab = usePortalChatStore((s) => s.tab);
  const incoming = usePortalChatStore((s) => s.chat?.incomingRequestCount ?? 0);
  const exploreCount = usePortalChatStore((s) => s.chat?.explore.length ?? 0);

  return (
    <div className="hub-chat-tabs">
      <button
        type="button"
        className={`hub-chat-tab ${tab === "friends" ? "hub-chat-tab--active" : ""}`}
        onClick={() => usePortalChatStore.getState().setTab("friends")}
      >
        Amigos
        {incoming > 0 && <span className="hub-chat-tab__badge">{incoming}</span>}
      </button>
      <button
        type="button"
        className={`hub-chat-tab ${tab === "explore" ? "hub-chat-tab--active" : ""}`}
        onClick={() => usePortalChatStore.getState().setTab("explore")}
      >
        Explorar
        {exploreCount > 0 && <span className="hub-chat-tab__badge">{exploreCount}</span>}
      </button>
    </div>
  );
}

export function ChatPanelHub() {
  const chat = usePortalChatStore((s) => s.chat);
  const peer = usePortalChatStore((s) => s.peer);
  const tab = usePortalChatStore((s) => s.tab);
  const loading = usePortalChatStore((s) => s.loading);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [chat?.messages, peer]);

  if (loading && !chat) return <p className="hub-chat-empty">Cargando…</p>;

  if (peer) {
    const messages = chat?.messages ?? [];
    if (!messages.length) return <p className="hub-chat-empty">Empieza la conversación.</p>;
    return (
      <div className="hub-chat-messages">
        {messages.map((m) => (
          <div key={m.id} className={`hub-chat-msg ${m.mine ? "hub-chat-msg--mine" : ""}`}>
            <MessageLinkText text={m.body} className="hub-chat-msg__body" />
            <span className="hub-chat-msg__time">{formatRelativeTime(m.createdAt)}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    );
  }

  if (tab === "explore") {
    const players = chat?.explore ?? [];
    if (!players.length) return <p className="hub-chat-empty">Nadie activo ahora.</p>;
    return (
      <ul className="hub-chat-list">
        {players.map((p) => (
          <li key={p.userId} className="hub-chat-list__row">
            <div>
              <p className="hub-chat-list__name">{p.displayName}</p>
              <p className="hub-chat-list__meta">@{p.username}</p>
            </div>
            {p.isFriend ? (
              <button
                type="button"
                className="hub-chat-mini-btn"
                onClick={() => {
                  const f = chat?.friends.find((x) => x.userId === p.userId);
                  if (f) usePortalChatStore.getState().setPeer(f);
                }}
              >
                Chat
              </button>
            ) : p.pendingRequest ? (
              <span className="hub-chat-pending">Pendiente</span>
            ) : (
              <button
                type="button"
                className="hub-chat-mini-btn hub-chat-mini-btn--accent"
                onClick={() => void usePortalChatStore.getState().sendFriendRequest(p.username)}
              >
                Solicitar
              </button>
            )}
          </li>
        ))}
      </ul>
    );
  }

  const incoming = chat?.requests.filter((r) => r.direction === "incoming") ?? [];
  const friends = chat?.friends ?? [];

  return (
    <div className="hub-chat-friends">
      {incoming.length > 0 && (
        <section>
          <p className="hub-chat-section-label">Solicitudes</p>
          <ul className="hub-chat-list">
            {incoming.map((r) => (
              <li key={r.id} className="hub-chat-list__row">
                <div>
                  <p className="hub-chat-list__name">{r.displayName}</p>
                  <p className="hub-chat-list__meta">@{r.username}</p>
                </div>
                <div className="hub-chat-list__actions">
                  <button
                    type="button"
                    className="hub-chat-mini-btn hub-chat-mini-btn--accent"
                    onClick={() => void usePortalChatStore.getState().acceptRequest(r.id, r.userId)}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    className="hub-chat-mini-btn"
                    onClick={() => void usePortalChatStore.getState().declineRequest(r.id, r.userId)}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ul className="hub-chat-list">
        {friends.map((f) => (
          <li key={f.userId}>
            <button type="button" className="hub-chat-list__item" onClick={() => usePortalChatStore.getState().setPeer(f)}>
              <span className={`hub-chat-dot ${f.online ? "hub-chat-dot--on" : ""}`} />
              <div className="hub-chat-list__body">
                <p className="hub-chat-list__name">{f.displayName}</p>
                <p className="hub-chat-list__meta">{f.lastMessage ?? `@${f.username}`}</p>
              </div>
            </button>
          </li>
        ))}
        {!friends.length && !incoming.length && <p className="hub-chat-empty">Sin amigos todavía.</p>}
      </ul>
    </div>
  );
}

export function ChatInputHub({ element }: { element: HubElement }) {
  const draft = usePortalChatStore((s) => s.draft);
  const peer = usePortalChatStore((s) => s.peer);
  const placeholder = element.logic?.constants?.PLACEHOLDER ?? element.label ?? "Escribe un mensaje…";

  return (
    <input
      type="text"
      className="hub-chat-input"
      value={draft}
      disabled={!peer}
      placeholder={peer ? String(placeholder) : "Abre un chat con un amigo…"}
      maxLength={2000}
      onChange={(e) => usePortalChatStore.getState().setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          void usePortalChatStore.getState().sendMessage();
        }
      }}
    />
  );
}

export function ChatSendHub({ element }: { element: HubElement }) {
  const draft = usePortalChatStore((s) => s.draft);
  const peer = usePortalChatStore((s) => s.peer);

  return (
    <button
      type="button"
      className="hub-chat-send"
      disabled={!peer || !draft.trim()}
      onClick={() => void usePortalChatStore.getState().sendMessage()}
    >
      {element.label?.trim() || "Enviar"}
    </button>
  );
}

export function ChatCloseHub({ element }: { element: HubElement }) {
  const peer = usePortalChatStore((s) => s.peer);

  return (
    <button
      type="button"
      className="hub-chat-close"
      onClick={() => {
        if (peer) usePortalChatStore.getState().setPeer(null);
        else usePortalChatStore.getState().close();
      }}
    >
      {element.label?.trim() || (peer ? "←" : "✕")}
    </button>
  );
}

export function ChatResizeHandleHub() {
  return (
    <button type="button" className="hub-chat-resize" onClick={() => usePortalChatStore.getState().cycleSize()}>
      ⤢
    </button>
  );
}

export function renderChatHubElement(element: HubElement) {
  switch (element.type) {
    case "chat-header":
      return <ChatHeaderHub element={element} />;
    case "chat-panel":
      return <ChatPanelHub />;
    case "chat-tabs":
      return <ChatTabsHub />;
    case "chat-input":
      return <ChatInputHub element={element} />;
    case "chat-send":
      return <ChatSendHub element={element} />;
    case "chat-close":
      return <ChatCloseHub element={element} />;
    case "chat-resize-handle":
      return <ChatResizeHandleHub />;
    default:
      return null;
  }
}

export function PortalChatBubbleOverlay({ elements }: { elements: HubElement[] }) {
  const isOpen = usePortalChatStore((s) => s.isOpen);
  const geometry = usePortalChatStore((s) => s.geometry);
  const error = usePortalChatStore((s) => s.error);
  const toast = usePortalChatStore((s) => s.toast);
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const overlayEls = elements.filter((e) => e.visible !== false && e.type !== "chat-bubble-toggle");

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!(e.target as HTMLElement).closest("[data-chat-drag-handle]")) return;
      setDragging(true);
      dragOffset.current = { x: e.clientX - geometry.x, y: e.clientY - geometry.y };
    },
    [geometry.x, geometry.y]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      usePortalChatStore.getState().setGeometry({
        x: Math.max(8, e.clientX - dragOffset.current.x),
        y: Math.max(8, e.clientY - dragOffset.current.y),
      });
    },
    [dragging]
  );

  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => void usePortalChatStore.getState().refresh(), 5000);
    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const positionedLayout = hasPositionedChatLayout(elements);

  return (
    <>
      <button type="button" className="hub-chat-backdrop" aria-label="Cerrar" onClick={() => usePortalChatStore.getState().close()} />
      {toast && <p className="hub-chat-toast hub-chat-toast--floating">{toast}</p>}
      {error && <p className="hub-chat-error hub-chat-error--floating">{error}</p>}
      {!positionedLayout && (
      <div
        className="hub-chat-bubble"
        style={{ left: geometry.x, top: geometry.y, width: geometry.width, height: geometry.height }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => setDragging(false)}
      >
        <div className="hub-chat-bubble__stack">
          {overlayEls.length > 0 ? (
            overlayEls.map((el) => (
              <div key={el.id} className={`hub-chat-slot hub-chat-slot--${el.type}`}>
                {renderChatHubElement(el)}
              </div>
            ))
          ) : (
            <>
              <ChatHeaderHub element={stubElement("chat-header", "Mensajes")} />
              <ChatTabsHub />
              <div className="hub-chat-slot hub-chat-slot--chat-panel hub-chat-slot--grow">
                <ChatPanelHub />
              </div>
              <div className="hub-chat-compose-row">
                <ChatInputHub element={stubElement("chat-input")} />
                <ChatSendHub element={stubElement("chat-send", "➤")} />
              </div>
              <div className="hub-chat-footer-row">
                <ChatCloseHub element={stubElement("chat-close", "✕")} />
                <ChatResizeHandleHub />
              </div>
            </>
          )}
        </div>
      </div>
      )}
    </>
  );
}
