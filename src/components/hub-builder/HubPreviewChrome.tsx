"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  backgroundExtendsIntoChrome,
  bindAccountHubElement,
  ensureScreenChrome,
  getActiveScreen,
  hasScreenChromeContent,
  hubChromeBarSurfaceStyle,
  isNativeChromeElementType,
  isScreenChromeVirtualId,
  resolveBackgroundChromeStyle,
} from "@craftlauncher/shared";
import { resolveHubBuilderPreviewLabel, useHubBuilderPreviewContext } from "@/components/hub-builder/hub-builder-preview-context";
import { useHubBuilderStore } from "@/lib/hub-builder-store";
import { useActiveScreen, useContentScreen } from "@/components/hub-builder/hub-builder-hooks";
import { HubRuntimePreview } from "@/components/hub-builder/HubRuntimePreview";
import { cn } from "@/lib/utils";

type ChromeDragState = { id: string; offsetX: number; offsetY: number };

/** Vista previa de la barra superior de la ventana activa al editar contenido. */
export function HubPreviewChrome() {
  const layout = useHubBuilderStore((s) => s.layout);
  const editTarget = useHubBuilderStore((s) => s.editTarget);
  const previewMode = useHubBuilderStore((s) => s.previewMode);
  const selectedId = useHubBuilderStore((s) => s.selectedId);
  const elementFocusFlash = useHubBuilderStore((s) => s.elementFocusFlash);
  const selectElement = useHubBuilderStore((s) => s.selectElement);
  const moveElement = useHubBuilderStore((s) => s.moveElement);
  const pushHistory = useHubBuilderStore((s) => s.pushHistory);
  const executeElementAction = useHubBuilderStore((s) => s.executeElementAction);
  const screen = useActiveScreen();
  const previewCtx = useHubBuilderPreviewContext();

  const stageRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<ChromeDragState | null>(null);
  const pendingPointerRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);

  const ownerScreen = useMemo(() => getActiveScreen(layout), [layout]);
  const contentScreen = useContentScreen();
  const chromeExtendsBg = backgroundExtendsIntoChrome(
    resolveBackgroundChromeStyle(contentScreen)
  );
  const chromeSurfaceStyle = useMemo(
    () => (chromeExtendsBg ? hubChromeBarSurfaceStyle(contentScreen) : null),
    [chromeExtendsBg, contentScreen]
  );
  const chrome = useMemo(
    () => (hasScreenChromeContent(ownerScreen) ? ensureScreenChrome(ownerScreen, layout) : null),
    [ownerScreen, layout]
  );
  const sorted = useMemo(
    () => (chrome ? [...chrome.elements].sort((a, b) => a.zIndex - b.zIndex) : []),
    [chrome]
  );

  const hidden =
    (!previewMode && (editTarget === "launcher-chrome" || isScreenChromeVirtualId(screen.id))) ||
    !chrome;

  const pointerToChromeLocal = useCallback((clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const rect = stage.getBoundingClientRect();
    const scaleX = stage.offsetWidth > 0 ? rect.width / stage.offsetWidth : 1;
    const scaleY = stage.offsetHeight > 0 ? rect.height / stage.offsetHeight : 1;
    return {
      x: (clientX - rect.left) / scaleX,
      y: (clientY - rect.top) / scaleY,
    };
  }, []);

  const beginDrag = useCallback(
    (id: string, clientX: number, clientY: number, pointerId: number) => {
      const el = sorted.find((item) => item.id === id);
      if (!el || el.locked) return false;

      const { x: cx, y: cy } = pointerToChromeLocal(clientX, clientY);
      setDragging({ id, offsetX: cx - el.x, offsetY: cy - el.y });
      stageRef.current?.setPointerCapture(pointerId);
      return true;
    },
    [pointerToChromeLocal, sorted]
  );

  const armPendingDrag = useCallback(
    (id: string, pointerId: number, startX: number, startY: number) => {
      pendingPointerRef.current = { id, pointerId, startX, startY };

      const onMove = (ev: PointerEvent) => {
        const pending = pendingPointerRef.current;
        if (!pending || pending.pointerId !== ev.pointerId) return;

        const dx = ev.clientX - pending.startX;
        const dy = ev.clientY - pending.startY;
        if (Math.hypot(dx, dy) < 4) return;

        pendingPointerRef.current = null;
        beginDrag(pending.id, ev.clientX, ev.clientY, ev.pointerId);
        cleanup();
      };

      const onUp = () => {
        pendingPointerRef.current = null;
        cleanup();
      };

      const cleanup = () => {
        window.removeEventListener("pointermove", onMove, true);
        window.removeEventListener("pointerup", onUp, true);
        window.removeEventListener("pointercancel", onUp, true);
      };

      window.addEventListener("pointermove", onMove, true);
      window.addEventListener("pointerup", onUp, true);
      window.addEventListener("pointercancel", onUp, true);
    },
    [beginDrag]
  );

  const handleEditPointerDown = useCallback(
    (e: React.PointerEvent, elId: string) => {
      const el = sorted.find((item) => item.id === elId);
      if (!el || el.locked) return;

      e.preventDefault();
      e.stopPropagation();
      selectElement(elId);
      setHoveredId(elId);
      armPendingDrag(elId, e.pointerId, e.clientX, e.clientY);
    },
    [armPendingDrag, selectElement, sorted]
  );

  const handlePreviewPointerDown = useCallback(
    (e: React.PointerEvent, elId: string) => {
      e.preventDefault();
      e.stopPropagation();
      void executeElementAction(elId);
    },
    [executeElementAction]
  );

  useEffect(() => {
    if (!dragging) return;

    let moved = false;
    const dragId = dragging.id;

    const onMove = (e: PointerEvent) => {
      moved = true;
      const { x, y } = pointerToChromeLocal(e.clientX, e.clientY);
      moveElement(dragId, x - dragging.offsetX, y - dragging.offsetY, { snap: false });
    };

    const onUp = () => {
      setDragging(null);
      if (!moved) return;

      const state = useHubBuilderStore.getState();
      const owner = getActiveScreen(state.layout);
      const chromeNow = ensureScreenChrome(owner, state.layout);
      const el = chromeNow.elements.find((item) => item.id === dragId);
      if (el) {
        moveElement(dragId, el.x, el.y);
      }
      pushHistory();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, moveElement, pointerToChromeLocal, pushHistory]);

  if (hidden || !chrome) {
    return null;
  }

  return (
    <div
      className={cn(
        "hub-builder-chrome shrink-0 overflow-hidden",
        !chromeExtendsBg && "border-b border-[var(--color-border)]"
      )}
      style={{
        height: chrome.height,
        width: "100%",
        ...(chromeExtendsBg
          ? chromeSurfaceStyle ?? undefined
          : { background: chrome.backgroundColor ?? "#0a0b0d" }),
      }}
    >
      <div ref={stageRef} className="relative h-full w-full">
        {sorted.map((el) => {
          const isSelected = selectedId === el.id;
          const isFlashing = elementFocusFlash?.elementId === el.id;
          const isActive = dragging?.id === el.id;
          const boxStyle = {
            left: el.x,
            top: el.y,
            width: el.width,
            height: el.height,
            zIndex: el.zIndex,
            borderRadius: el.style.borderRadius ?? 6,
          };

          const pointerDown = previewMode
            ? (e: React.PointerEvent) => handlePreviewPointerDown(e, el.id)
            : (e: React.PointerEvent) => handleEditPointerDown(e, el.id);

          if (!isNativeChromeElementType(el.type)) {
            return (
              <div
                key={el.id}
                data-hub-el="true"
                data-element-id={el.id}
                className={cn(
                  "overflow-hidden",
                  previewMode ? "cursor-pointer" : "touch-none cursor-move",
                  !previewMode && "hub-builder-el-interactive",
                  isSelected && "hub-builder-el-selected",
                  isFlashing && "hub-builder-el-flash",
                  isActive && "hub-builder-el-active",
                  !previewMode && hoveredId === el.id && "hub-builder-el-hovered"
                )}
                style={{ ...boxStyle, position: "absolute" }}
                onPointerEnter={
                  previewMode ? undefined : () => setHoveredId(el.id)
                }
                onPointerLeave={
                  previewMode
                    ? undefined
                    : () => setHoveredId((prev) => (prev === el.id ? null : prev))
                }
                onPointerDown={pointerDown}
              >
                <div className={previewMode ? "h-full w-full" : "pointer-events-none h-full w-full"}>
                  <HubRuntimePreview
                    element={bindAccountHubElement(el, {
                      displayName: "Usuario demo",
                      username: "usuario",
                      tier: "free",
                    })}
                  />
                </div>
              </div>
            );
          }

          const label =
            el.type === "chrome-status"
              ? "Sync · preview"
              : resolveHubBuilderPreviewLabel(el, previewCtx);

          return (
            <div
              key={el.id}
              data-hub-el="true"
              data-element-id={el.id}
              className={cn(
                "flex items-center overflow-hidden px-1 text-[11px] text-[var(--color-text-soft)]",
                previewMode ? "cursor-pointer" : "touch-none cursor-move",
                !previewMode && "hub-builder-el-interactive",
                isSelected && "hub-builder-el-selected",
                isFlashing && "hub-builder-el-flash",
                isActive && "hub-builder-el-active",
                !previewMode && hoveredId === el.id && "hub-builder-el-hovered"
              )}
              style={{
                ...boxStyle,
                position: "absolute",
                background: el.style.backgroundColor ?? "transparent",
                color: el.style.textColor ?? "#d7d8da",
                fontSize: el.style.fontSize ?? 11,
                fontWeight: el.style.fontWeight ?? "normal",
              }}
              onPointerEnter={previewMode ? undefined : () => setHoveredId(el.id)}
              onPointerLeave={
                previewMode
                  ? undefined
                  : () => setHoveredId((prev) => (prev === el.id ? null : prev))
              }
              onPointerDown={pointerDown}
            >
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
