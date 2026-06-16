"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  computeElementFocusZoom,
  computeResizeDelta,
  clampHubZoom,
  type ResizeHandle,
} from "@/lib/hub-builder-data";
import {
  canvasPointToElementLocal,
  elementAbsolutePosition,
  elementEditorBounds,
} from "@/lib/hub-builder-placement";
import {
  backgroundExtendsIntoChrome,
  computeChatOverlayBounds,
  hubScreenContentBackgroundStyle,
  hubWindowFrameBackgroundStyle,
  isChatHubElementType,
  isScreenChromeVirtualId,
  normalizeHubBackgroundImageUrl,
  resolveBackgroundChromeStyle,
} from "@craftlauncher/shared";
import { useHubBuilderStore } from "@/lib/hub-builder-store";
import {
  resolveHubBuilderViewport,
  useActiveScreen,
  useContentScreen,
} from "@/components/hub-builder/hub-builder-hooks";
import { HubElementView } from "./HubElementView";
import { HubAdvancedCssSheet, HubCssElementsProvider } from "./HubCssRuntimeContext";
import { hasLogicBadge, LogicBadge, logicBadgeLabel } from "./LogicBadge";
import { HubPreviewToasts } from "./HubPreviewToasts";
import { HubPreviewChrome } from "./HubPreviewChrome";
import { ResizeHandles } from "./ResizeHandles";
import {
  canvasLayerElements,
  hitTestHubElementAtPoint,
  resolveEditorCanvasZIndex,
} from "@/lib/hub-builder-hit-test";
import {
  resolveHubCanvasGridOverlayStyle,
  resolveHubEditorCanvasStyle,
} from "@/lib/hub-editor-canvas-settings";
import {
  GAME_MENU_SCREEN_ID,
  detectPrimaryDisplaySize,
  minecraftElementGuiPos,
  minecraftGuiToDesignPos,
  minecraftPointerToDesignLocal,
  resolveMinecraftGuiCanvas,
} from "@/lib/game-ui-export";
import { GAME_LOADING_SCREEN_ID } from "@/lib/loading-ui-export";
import { GameMenuDecor } from "@/components/hub-builder/GameMenuDecor";
import { GameLoadingDecor } from "@/components/hub-builder/GameLoadingDecor";
import { PreviewFrameResizer } from "@/components/hub-builder/PreviewFrameResizer";
import type { HubElement } from "@/types/hub-builder";

// Antes restábamos padding extra y el canvas quedaba "más chico" que en el launcher.
// Mantenerlo mínimo para que el fit/zoom coincida con el runtime.
const CANVAS_PADDING = 0;

type DragState = { id: string; offsetX: number; offsetY: number };
type ResizeState = {
  id: string;
  handle: ResizeHandle;
  origin: { x: number; y: number; width: number; height: number };
  startLocalX: number;
  startLocalY: number;
};

type MarqueeState = {
  startX: number;
  startY: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

type CanvasPan = { x: number; y: number };

function queryCanvasElementNode(container: HTMLElement, elementId: string): Element | null {
  try {
    return container.querySelector(`[data-element-id="${CSS.escape(elementId)}"]`);
  } catch {
    return container.querySelector(`[data-element-id="${elementId}"]`);
  }
}

/** Centro del elemento respecto al área visible del contenedor (post-transform). */
function measureElementViewportCenter(
  container: HTMLElement,
  node: Element
): { cx: number; cy: number } {
  const er = node.getBoundingClientRect();
  const cr = container.getBoundingClientRect();
  return {
    cx: er.left + er.width / 2 - cr.left,
    cy: er.top + er.height / 2 - cr.top,
  };
}

export function HubCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pendingCanvasFocusRef = useRef<number | null>(null);
  const [pan, setPan] = useState<CanvasPan>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const marqueeRef = useRef<MarqueeState | null>(null);
  const marqueePointerIdRef = useRef<number | null>(null);
  const spaceHeldRef = useRef(false);
  const panRef = useRef<CanvasPan>({ x: 0, y: 0 });
  const viewPanRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [viewPanning, setViewPanning] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const pendingPointerRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);

  const canvasFocusRequest = useHubBuilderStore((s) => s.canvasFocusRequest);
  const elementFocusFlash = useHubBuilderStore((s) => s.elementFocusFlash);
  const {
    layout,
    selectedId,
    selectedIds,
    showGrid,
    zoom,
    autoFit,
    selectElement,
    selectElements,
    moveElement,
    resizeElement,
    pushHistory,
    setFocusZoom,
    setZoom,
    setZoomFit,
    setAutoFit,
    openContextMenu,
    previewMode,
    previewFrameSize,
    setPreviewFrameSize,
    setGameMenuUiScale,
    executeElementAction,
    handleRuntimeChange,
    setEditTarget,
    editorCanvasSettings,
  } = useHubBuilderStore();

  const workspaceBackgroundStyle = useMemo(
    () => resolveHubEditorCanvasStyle(editorCanvasSettings),
    [editorCanvasSettings]
  );

  const editScreen = useActiveScreen();
  const contentScreen = useContentScreen();
  const editTarget = useHubBuilderStore((s) => s.editTarget);
  const canvasScreen = previewMode ? contentScreen : editScreen;
  const sortedElements = [...canvasScreen.elements].sort((a, b) => a.zIndex - b.zIndex);
  const editableElements = useMemo(
    () => canvasLayerElements(sortedElements),
    [sortedElements]
  );
  const chatGroupBounds = useMemo(() => {
    if (previewMode) return null;
    const activeIds = selectedIds?.length ? selectedIds : selectedId ? [selectedId] : [];
    if (!activeIds.length) return null;
    const selected = canvasScreen.elements.filter((e) => activeIds.includes(e.id));
    if (!selected.some((e) => isChatHubElementType(e.type))) return null;
    return computeChatOverlayBounds(canvasScreen.elements);
  }, [previewMode, selectedId, selectedIds, canvasScreen.elements]);
  const isGameMenu = layout.activeScreenId === GAME_MENU_SCREEN_ID;
  const isLoadingScreen = layout.activeScreenId === GAME_LOADING_SCREEN_ID;
  const isMinecraftScreen = isGameMenu || isLoadingScreen;
  const minecraftDesignW = canvasScreen.width;
  const minecraftDesignH = canvasScreen.height;
  const [pcDisplay, setPcDisplay] = useState(detectPrimaryDisplaySize);

  useEffect(() => {
    const syncDisplay = () => setPcDisplay(detectPrimaryDisplaySize());
    syncDisplay();
    window.addEventListener("resize", syncDisplay);
    return () => window.removeEventListener("resize", syncDisplay);
  }, []);

  const minecraftSimWindow = isMinecraftScreen
    ? previewMode
      ? (previewFrameSize ?? pcDisplay)
      : pcDisplay
    : null;

  const minecraftGuiCanvas = useMemo(() => {
    if (!minecraftSimWindow) return null;
    return resolveMinecraftGuiCanvas(minecraftSimWindow);
  }, [minecraftSimWindow]);

  const minecraftCanvasFrame = minecraftGuiCanvas
    ? { width: minecraftGuiCanvas.guiW, height: minecraftGuiCanvas.guiH }
    : null;

  const viewport = resolveHubBuilderViewport(layout, canvasScreen, {
    previewMode,
    elements: sortedElements,
    previewFrameSize: minecraftCanvasFrame,
  });

  useLayoutEffect(() => {
    if (isMinecraftScreen) {
      setGameMenuUiScale(1);
    }
  }, [isMinecraftScreen, setGameMenuUiScale]);

  const resolveMinecraftRenderPos = useCallback(
    (el: HubElement) => {
      if (!isMinecraftScreen || !minecraftGuiCanvas) {
        const pos = elementAbsolutePosition(canvasScreen.elements, el.id);
        return { x: pos.x, y: pos.y, width: el.width, height: el.height };
      }
      return minecraftElementGuiPos(
        el,
        minecraftDesignW,
        minecraftDesignH,
        minecraftGuiCanvas.guiW,
        minecraftGuiCanvas.guiH
      );
    },
    [
      isMinecraftScreen,
      minecraftGuiCanvas,
      canvasScreen.elements,
      minecraftDesignW,
      minecraftDesignH,
    ]
  );

  const scrollMode = Boolean(canvasScreen.scroll);
  const previewHeight = viewport.frameHeight;
  const isLauncherChromeEdit =
    editTarget === "launcher-chrome" || isScreenChromeVirtualId(editScreen.id);
  const isLauncherChrome = !previewMode && isLauncherChromeEdit;
  const showChromeBar = !isMinecraftScreen && (previewMode || !isLauncherChromeEdit);
  const gridOverlayStyle = useMemo(
    () => resolveHubCanvasGridOverlayStyle(editorCanvasSettings, isLauncherChrome),
    [editorCanvasSettings, isLauncherChrome]
  );

  panRef.current = pan;

  const pointerToCanvas = useCallback((clientX: number, clientY: number) => {
    const el = canvasRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const scaleX = el.offsetWidth > 0 ? rect.width / el.offsetWidth : zoom;
    const scaleY = el.offsetHeight > 0 ? rect.height / el.offsetHeight : zoom;
    return {
      x: (clientX - rect.left) / scaleX,
      y: (clientY - rect.top) / scaleY,
    };
  }, [zoom]);

  const centerPanForZoom = useCallback(
    (nextZoom: number) => {
      const container = containerRef.current;
      if (!container) return;
      const availW = container.clientWidth - CANVAS_PADDING;
      const availH = container.clientHeight - CANVAS_PADDING;
      if (availW <= 0 || availH <= 0) return;
      const scaledW = viewport.frameWidth * nextZoom;
      const scaledH = previewHeight * nextZoom;
      setPan({
        x: Math.max(0, (availW - scaledW) / 2),
        y: Math.max(0, (availH - scaledH) / 2),
      });
    },
    [previewHeight, viewport.frameWidth]
  );

  const fitToContainer = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const availW = container.clientWidth - CANVAS_PADDING;
    if (availW <= 0) return;

    if (scrollMode) {
      const fitW = availW / viewport.frameWidth;
      const nextZoom = clampHubZoom(fitW, isLauncherChrome ? "launcher-chrome" : "screen");
      setZoomFit(nextZoom);
      setPan({ x: Math.max(0, (availW - viewport.frameWidth * nextZoom) / 2), y: 0 });
      return;
    }

    const availH = container.clientHeight - CANVAS_PADDING;
    if (availH <= 0) return;

    // Ventana fija: 1:1 cuando cabe (mismos píxeles que Electron).
    if (viewport.usesFixedWindow && availW >= viewport.frameWidth && availH >= previewHeight) {
      setZoomFit(1);
      centerPanForZoom(1);
      return;
    }

    const fit = Math.min(availW / viewport.frameWidth, availH / previewHeight);
    const nextZoom = clampHubZoom(fit, isLauncherChrome ? "launcher-chrome" : "screen");
    setZoomFit(nextZoom);
    centerPanForZoom(nextZoom);
  }, [previewHeight, viewport.frameWidth, viewport.usesFixedWindow, scrollMode, isLauncherChrome, setZoomFit, centerPanForZoom]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (useHubBuilderStore.getState().autoFit) fitToContainer();
    });

    observer.observe(container);
    if (autoFit) fitToContainer();

    return () => observer.disconnect();
  }, [autoFit, fitToContainer, canvasScreen.id, layout.window?.width, layout.window?.height]);

  useEffect(() => {
    if (autoFit) fitToContainer();
  }, [autoFit, fitToContainer, viewport.frameWidth, viewport.frameHeight]);

  useEffect(() => {
    if (!previewMode) return;
    const id = requestAnimationFrame(() => fitToContainer());
    return () => cancelAnimationFrame(id);
  }, [previewMode, fitToContainer, viewport.frameWidth, viewport.frameHeight]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      if (!previewMode && scrollMode && !e.ctrlKey && !e.metaKey) return;
      e.preventDefault();

      const oldZoom = useHubBuilderStore.getState().zoom;
      const step = Math.min(0.15, Math.max(0.02, Math.abs(e.deltaY) * 0.002));
      const nextZoom = clampHubZoom(
        oldZoom + (e.deltaY < 0 ? step : -step),
        isLauncherChrome ? "launcher-chrome" : "screen"
      );
      if (nextZoom === oldZoom) return;

      const rect = container.getBoundingClientRect();
      const pointerX = e.clientX - rect.left + container.scrollLeft;
      const pointerY = e.clientY - rect.top + container.scrollTop;

      setPan((prev) => {
        const worldX = (pointerX - prev.x) / oldZoom;
        const worldY = (pointerY - prev.y) / oldZoom;
        return {
          x: pointerX - worldX * nextZoom,
          y: pointerY - worldY * nextZoom,
        };
      });
      setZoom(nextZoom);
      setAutoFit(false);
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [previewMode, scrollMode, isLauncherChrome, setZoom, setAutoFit]);

  useEffect(() => {
    if (autoFit) fitToContainer();
    else if (
      !useHubBuilderStore.getState().canvasFocusRequest &&
      pendingCanvasFocusRef.current === null
    ) {
      setPan({ x: 0, y: 0 });
      containerRef.current?.scrollTo({ left: 0, top: 0, behavior: "auto" });
    }
  }, [canvasScreen.id, autoFit, fitToContainer]);

  useLayoutEffect(() => {
    if (!canvasFocusRequest || previewMode) return;
    if (canvasFocusRequest.screenId !== layout.activeScreenId) return;

    const container = containerRef.current;
    if (!container) return;

    const elementId = canvasFocusRequest.elementId;
    const requestToken = canvasFocusRequest.token;
    pendingCanvasFocusRef.current = requestToken;
    let cancelled = false;

    const finish = () => {
      if (cancelled) return;
      if (pendingCanvasFocusRef.current === requestToken) {
        pendingCanvasFocusRef.current = null;
      }
      const latest = useHubBuilderStore.getState().canvasFocusRequest;
      if (latest?.token === requestToken) {
        useHubBuilderStore.setState({ canvasFocusRequest: null });
      }
    };

    const screen = layout.screens.find((s) => s.id === canvasFocusRequest.screenId);
    if (!screen) {
      finish();
      return;
    }

    let focusX = 0;
    let focusY = 0;
    let elementWidth = 0;
    let elementHeight = 0;

    if (canvasFocusRequest.surface === "chrome") {
      const el = screen.chrome?.elements?.find((e) => e.id === elementId);
      if (!el) {
        finish();
        return;
      }
      focusX = el.x + el.width / 2;
      focusY = el.y + el.height / 2;
      elementWidth = el.width;
      elementHeight = el.height;
    } else {
      const el = screen.elements.find((e) => e.id === elementId);
      if (!el) {
        finish();
        return;
      }
      const pos = elementAbsolutePosition(screen.elements, el.id);
      const chromeOffset = showChromeBar ? viewport.chromeHeight : 0;
      focusX = pos.x + el.width / 2;
      focusY = chromeOffset + pos.y + el.height / 2;
      elementWidth = el.width;
      elementHeight = el.height;
    }

    const availW = container.clientWidth;
    const availH = container.clientHeight;
    const currentZoom = useHubBuilderStore.getState().zoom;
    const zoomTarget = isLauncherChrome ? "launcher-chrome" : "screen";
    const targetZoom = computeElementFocusZoom({
      elementWidth,
      elementHeight,
      viewportWidth: availW,
      viewportHeight: availH,
      currentZoom,
      editTarget: zoomTarget,
    });

    if (targetZoom !== currentZoom) {
      setFocusZoom(targetZoom);
    }

    const scaledX = focusX * targetZoom;
    const scaledY = focusY * targetZoom;
    const idealPanX = availW / 2 - scaledX;
    const idealPanY = availH / 2 - scaledY;

    setPan({
      x: Math.max(0, idealPanX),
      y: Math.max(0, idealPanY),
    });
    container.scrollTo({
      left: Math.max(0, -idealPanX),
      top: Math.max(0, -idealPanY),
      behavior: "auto",
    });

    const correctFromDom = (attempt: number) => {
      if (cancelled) return;

      const node = queryCanvasElementNode(container, elementId);
      if (!node) {
        if (attempt < 12) {
          requestAnimationFrame(() => correctFromDom(attempt + 1));
        } else {
          finish();
        }
        return;
      }

      const { cx, cy } = measureElementViewportCenter(container, node);
      const dx = availW / 2 - cx;
      const dy = availH / 2 - cy;

      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
        if (attempt < 5) {
          requestAnimationFrame(() => correctFromDom(attempt + 1));
          return;
        }
      }

      finish();
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => correctFromDom(0));
    });

    return () => {
      cancelled = true;
    };
  }, [
    canvasFocusRequest,
    isLauncherChrome,
    layout.activeScreenId,
    layout.screens,
    previewMode,
    setFocusZoom,
    showChromeBar,
    viewport.chromeHeight,
  ]);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      spaceHeldRef.current = true;
      setSpaceHeld(true);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      spaceHeldRef.current = false;
      setSpaceHeld(false);
      viewPanRef.current = null;
      setViewPanning(false);
    };

    const onBlur = () => {
      spaceHeldRef.current = false;
      setSpaceHeld(false);
      viewPanRef.current = null;
      setViewPanning(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const handleViewPanPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const canPan =
        spaceHeldRef.current || e.button === 1 || (previewMode && e.button === 0 && e.altKey);
      if (!canPan) return;
      if (e.button !== 0 && e.button !== 1) return;

      e.preventDefault();
      e.stopPropagation();
      setAutoFit(false);
      setViewPanning(true);

      const origin = panRef.current;
      viewPanRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        panX: origin.x,
        panY: origin.y,
      };

      const onMove = (ev: PointerEvent) => {
        const session = viewPanRef.current;
        if (!session || session.pointerId !== ev.pointerId) return;
        setPan({
          x: session.panX + (ev.clientX - session.startX),
          y: session.panY + (ev.clientY - session.startY),
        });
      };

      const onUp = (ev: PointerEvent) => {
        const session = viewPanRef.current;
        if (!session || session.pointerId !== ev.pointerId) return;
        viewPanRef.current = null;
        setViewPanning(false);
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
    [previewMode, setAutoFit]
  );

  // En modo scroll NO cambiamos tamaños: respetamos auto-fit/zoom (fitToContainer se encarga).

  const hitElementAtPointer = useCallback(
    (clientX: number, clientY: number) => {
      const { x, y } = pointerToCanvas(clientX, clientY);
      return hitTestHubElementAtPoint(editableElements, x, y, (el) => {
        if (isMinecraftScreen && minecraftGuiCanvas) {
          return resolveMinecraftRenderPos(el);
        }
        const pos = elementAbsolutePosition(canvasScreen.elements, el.id);
        return { x: pos.x, y: pos.y, width: el.width, height: el.height };
      });
    },
    [
      editableElements,
      pointerToCanvas,
      resolveMinecraftRenderPos,
      isMinecraftScreen,
      minecraftGuiCanvas,
      canvasScreen.elements,
    ]
  );

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (previewMode || dragging || resizing) return;
      const hit = hitElementAtPointer(e.clientX, e.clientY);
      setHoveredId(hit?.id ?? null);
    },
    [previewMode, dragging, resizing, hitElementAtPointer]
  );

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    if (previewMode) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    const { x, y } = pointerToCanvas(e.clientX, e.clientY);
    openContextMenu({
      open: true,
      x: e.clientX,
      y: e.clientY,
      target: "canvas",
      canvasX: x,
      canvasY: y,
    });
  };

  const handleElementContextMenu = (e: React.MouseEvent, elementId: string) => {
    if (previewMode) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    selectElement(elementId);
    const { x, y } = pointerToCanvas(e.clientX, e.clientY);
    openContextMenu({
      open: true,
      x: e.clientX,
      y: e.clientY,
      target: "element",
      elementId,
      canvasX: x,
      canvasY: y,
    });
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (previewMode) return;
    if (e.target === canvasRef.current) selectElement(null);
  };

  const beginDrag = useCallback(
    (id: string, clientX: number, clientY: number, pointerId: number) => {
      const el = canvasScreen.elements.find((item) => item.id === id);
      if (!el || el.locked) return false;

      const { x: cx, y: cy } = pointerToCanvas(clientX, clientY);
      const pos = resolveMinecraftRenderPos(el);
      setDragging({ id, offsetX: cx - pos.x, offsetY: cy - pos.y });
      canvasRef.current?.setPointerCapture(pointerId);
      return true;
    },
    [canvasScreen.elements, pointerToCanvas, resolveMinecraftRenderPos]
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

      const onUp = (ev: PointerEvent) => {
        if (pendingPointerRef.current?.pointerId === ev.pointerId) {
          pendingPointerRef.current = null;
        }
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

  const handleElementPointerDown = useCallback(
    (e: React.PointerEvent, elementId: string) => {
      if (previewMode) return;
      if (e.button !== 0) return;
      if (spaceHeldRef.current) return;
      if (dragging || resizing) return;

      const eventTarget = e.target as HTMLElement | null;
      if (eventTarget?.closest?.(".hub-builder-resize-handle")) return;

      const el = canvasScreen.elements.find((item) => item.id === elementId);
      if (!el || el.locked) return;

      e.stopPropagation();
      e.preventDefault();
      const hit = hitElementAtPointer(e.clientX, e.clientY);
      const targetId = hit?.id ?? elementId;
      const hitElement = canvasScreen.elements.find((item) => item.id === targetId);
      if (!hitElement || hitElement.locked) return;

      const nextTarget = isLauncherChromeEdit ? "launcher-chrome" : "screen";
      if (editTarget !== nextTarget) setEditTarget(nextTarget);
      selectElement(targetId);
      setHoveredId(targetId);
      armPendingDrag(targetId, e.pointerId, e.clientX, e.clientY);
    },
    [
      armPendingDrag,
      dragging,
      canvasScreen.elements,
      editTarget,
      hitElementAtPointer,
      isLauncherChromeEdit,
      previewMode,
      resizing,
      selectElement,
      setEditTarget,
    ]
  );

  const handleCanvasContextMenuCapture = useCallback(
    (e: React.MouseEvent) => {
      if (previewMode) return;
      const hit = hitElementAtPointer(e.clientX, e.clientY);
      if (!hit) return;
      handleElementContextMenu(e, hit.id);
    },
    [hitElementAtPointer, handleElementContextMenu, previewMode]
  );

  const startResize = useCallback(
    (e: React.PointerEvent, id: string, handle: ResizeHandle) => {
      const el = canvasScreen.elements.find((item) => item.id === id);
      if (!el || el.locked) return;

     e.stopPropagation();
      e.preventDefault();
      selectElement(id);

      const { x: cx, y: cy } = pointerToCanvas(e.clientX, e.clientY);
      const local =
        isMinecraftScreen && minecraftGuiCanvas && !previewMode
          ? minecraftPointerToDesignLocal(
              el,
              cx,
              cy,
              minecraftDesignW,
              minecraftDesignH,
              minecraftGuiCanvas.guiW,
              minecraftGuiCanvas.guiH
            )
          : canvasPointToElementLocal(canvasScreen.elements, el, cx, cy);

      setResizing({
        id,
        handle,
        origin: { x: el.x, y: el.y, width: el.width, height: el.height },
        startLocalX: local.x,
        startLocalY: local.y,
      });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [
      pointerToCanvas,
      canvasScreen.elements,
      selectElement,
      isMinecraftScreen,
      minecraftGuiCanvas,
      previewMode,
      minecraftDesignW,
      minecraftDesignH,
    ]
  );

  useEffect(() => {
    if (!dragging) return;

    let moved = false;

    const dragId = dragging.id;

    const onMove = (e: PointerEvent) => {
      moved = true;
      const { x, y } = pointerToCanvas(e.clientX, e.clientY);
      const frameX = x - dragging.offsetX;
      const frameY = y - dragging.offsetY;
      const screenNow = useHubBuilderStore.getState().getActiveScreen();
      const el = screenNow.elements.find((item) => item.id === dragId);
      if (el && isMinecraftScreen && minecraftGuiCanvas && !previewMode) {
        const design = minecraftGuiToDesignPos(
          frameX,
          frameY,
          minecraftDesignW,
          minecraftDesignH,
          minecraftGuiCanvas.guiW,
          minecraftGuiCanvas.guiH
        );
        moveElement(dragId, design.x, design.y, { snap: false });
      } else {
        moveElement(dragId, frameX, frameY, { snap: false });
      }
    };

    const onUp = () => {
      setDragging(null);
      if (!moved) return;

      const screenNow = useHubBuilderStore.getState().getActiveScreen();
      const el = screenNow.elements.find((item) => item.id === dragId);
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
  }, [
    dragging,
    moveElement,
    pushHistory,
    pointerToCanvas,
    isMinecraftScreen,
    previewMode,
    minecraftGuiCanvas,
    minecraftDesignW,
    minecraftDesignH,
  ]);

  useEffect(() => {
    if (!resizing) return;

    const onMove = (e: PointerEvent) => {
      const { x, y } = pointerToCanvas(e.clientX, e.clientY);
      const screenNow = useHubBuilderStore.getState().getActiveScreen();
      const el = screenNow.elements.find((it) => it.id === resizing.id);
      if (!el) return;

      const state = useHubBuilderStore.getState();
      const isMcScreen =
        screenNow.id === GAME_MENU_SCREEN_ID || screenNow.id === GAME_LOADING_SCREEN_ID;
      const mcWin = isMcScreen
        ? state.previewMode
          ? (state.previewFrameSize ?? detectPrimaryDisplaySize())
          : detectPrimaryDisplaySize()
        : null;
      const mcGui = mcWin ? resolveMinecraftGuiCanvas(mcWin) : null;
      const vp = resolveHubBuilderViewport(state.layout, screenNow, {
        previewMode: state.previewMode,
        previewFrameSize: mcGui ? { width: mcGui.guiW, height: mcGui.guiH } : null,
      });
      const mcEdit = isMcScreen && !state.previewMode;
      const local =
        mcEdit && mcGui
          ? minecraftPointerToDesignLocal(
              el,
              x,
              y,
              screenNow.width,
              screenNow.height,
              mcGui.guiW,
              mcGui.guiH
            )
          : canvasPointToElementLocal(screenNow.elements, el, x, y);
      const dx = local.x - resizing.startLocalX;
      const dy = local.y - resizing.startLocalY;
      const { width: boundsW, height: boundsH } = elementEditorBounds(
        screenNow.elements,
        el,
        mcEdit ? screenNow.width : vp.canvasWidth,
        mcEdit ? screenNow.height : vp.canvasHeight
      );
      const next = computeResizeDelta(
        resizing.origin,
        resizing.handle,
        dx,
        dy,
        boundsW,
        boundsH
      );
      resizeElement(resizing.id, next);
    };

    const onUp = () => {
      setResizing(null);
      pushHistory();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [
    resizing,
    resizeElement,
    pushHistory,
    pointerToCanvas,
    viewport.canvasWidth,
    viewport.canvasHeight,
  ]);

  const screenHasBackgroundImage = Boolean(normalizeHubBackgroundImageUrl(canvasScreen.backgroundImage));
  const canvasGrid = !previewMode && showGrid && !screenHasBackgroundImage && !isMinecraftScreen;

  const startMarquee = useCallback(
    (e: React.PointerEvent) => {
      if (previewMode) return;
      if (spaceHeldRef.current) return;
      if (e.button !== 0) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (dragging || resizing) return;
      if (hitElementAtPointer(e.clientX, e.clientY)) return;

      e.preventDefault();
      const { x, y } = pointerToCanvas(e.clientX, e.clientY);
      const next = { startX: x, startY: y, x, y, w: 0, h: 0 };
      marqueeRef.current = next;
      setMarquee(next);
      selectElement(null);
      marqueePointerIdRef.current = e.pointerId;

      const onMove = (ev: PointerEvent) => {
        if (marqueePointerIdRef.current !== ev.pointerId) return;
        const base = marqueeRef.current;
        if (!base) return;
        const pt = pointerToCanvas(ev.clientX, ev.clientY);
        const left = Math.min(base.startX, pt.x);
        const top = Math.min(base.startY, pt.y);
        const w = Math.abs(pt.x - base.startX);
        const h = Math.abs(pt.y - base.startY);
        const updated = { ...base, x: left, y: top, w, h };
        marqueeRef.current = updated;
        setMarquee(updated);
      };

      const onUp = (ev: PointerEvent) => {
        if (marqueePointerIdRef.current !== ev.pointerId) return;
        marqueePointerIdRef.current = null;

        const box = marqueeRef.current;
        marqueeRef.current = null;

        if (!box) {
          setMarquee(null);
          selectElement(null);
          cleanup();
          return;
        }

        const isClick = box.w < 4 && box.h < 4;
        if (isClick) {
          setMarquee(null);
          selectElement(null);
          cleanup();
          return;
        }

        const rx0 = box.x;
        const ry0 = box.y;
        const rx1 = box.x + box.w;
        const ry1 = box.y + box.h;

        const hits: { id: string; z: number }[] = [];
        for (const el of canvasScreen.elements) {
          const pos = elementAbsolutePosition(canvasScreen.elements, el.id);
          const ex0 = pos.x;
          const ey0 = pos.y;
          const ex1 = pos.x + el.width;
          const ey1 = pos.y + el.height;
          const intersects = ex0 <= rx1 && ex1 >= rx0 && ey0 <= ry1 && ey1 >= ry0;
          if (intersects) hits.push({ id: el.id, z: el.zIndex });
        }

        hits.sort((a, b) => b.z - a.z);
        const ids = hits.map((h) => h.id);
        if (ids.length) selectElements(ids, ids[0] ?? null);
        else selectElement(null);

        setMarquee(null);
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
    [dragging, hitElementAtPointer, previewMode, pointerToCanvas, resizing, canvasScreen.elements, selectElement, selectElements]
  );

  const screenBackgroundStyle = useMemo(
    () =>
      isLauncherChromeEdit || isGameMenu
        ? {}
        : hubScreenContentBackgroundStyle(contentScreen, "editor"),
    [contentScreen, isLauncherChromeEdit, isGameMenu]
  );

  const chromeIntegratedBg = backgroundExtendsIntoChrome(
    resolveBackgroundChromeStyle(contentScreen)
  );

  const frameBackgroundStyle = useMemo(
    () =>
      showChromeBar
        ? hubWindowFrameBackgroundStyle(contentScreen, viewport.chromeHeight, "editor")
        : {},
    [contentScreen, showChromeBar, viewport.chromeHeight]
  );

  const scaledW = viewport.frameWidth * zoom;
  const scaledH = previewHeight * zoom;
  const shellWidth = `max(100%, ${pan.x + scaledW}px)`;
  const shellHeight = `max(100%, ${pan.y + scaledH}px)`;

  return (
    <div
      ref={containerRef}
      onPointerDownCapture={handleViewPanPointerDown}
      className={cn(
        "relative h-full min-h-0 overflow-auto rounded-xl border",
        previewMode
          ? "border-[var(--color-accent-muted)]/40"
          : "border-[var(--color-border-subtle)]",
        !previewMode && spaceHeld && (viewPanning ? "cursor-grabbing" : "cursor-grab"),
        previewMode && (viewPanning ? "cursor-grabbing" : "cursor-grab")
      )}
      style={workspaceBackgroundStyle}
    >
      {previewMode && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-3 top-3 z-30 rounded-lg border border-[var(--color-accent-muted)]/35 bg-[#0a0b0d]/95 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-accent)] shadow-lg backdrop-blur-sm"
        >
          Modo probar · Espacio+arrastrar o rueda para zoom
          {previewFrameSize ? ` · ${previewFrameSize.width}×${previewFrameSize.height}` : ""}
        </div>
      )}
      {!previewMode && isMinecraftScreen && minecraftGuiCanvas && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-3 top-3 z-30 rounded-lg border border-[var(--color-border-subtle)] bg-black/90 px-2.5 py-1 text-[10px] font-medium text-[var(--color-text-soft)] shadow-lg"
        >
          Ventana {minecraftGuiCanvas.windowW}×{minecraftGuiCanvas.windowH} · editor en GUI{" "}
          {minecraftGuiCanvas.guiW}×{minecraftGuiCanvas.guiH} (igual que Minecraft)
        </div>
      )}
      <div style={{ width: shellWidth, height: shellHeight, minWidth: "100%", minHeight: "100%" }}>
        <div
          className={cn(chromeIntegratedBg ? "hub-frame-integrated-bg" : undefined, "relative")}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            width: viewport.frameWidth,
            height: previewHeight,
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
            ...frameBackgroundStyle,
          }}
        >
        {showChromeBar && <HubPreviewChrome />}

        <div
          className={cn(
            "relative shrink-0",
            viewport.usesFixedWindow && !scrollMode && "overflow-hidden",
            scrollMode && viewport.usesFixedWindow && "overflow-y-auto overflow-x-hidden"
          )}
          style={{
            width: viewport.contentWidth,
            height: viewport.contentHeight,
            flex: "0 0 auto",
          }}
        >
          <div
            ref={canvasRef}
            role="application"
            aria-label={previewMode ? "Vista previa del launcher" : "Canvas del launcher"}
            data-game-menu={isGameMenu ? "true" : undefined}
            data-game-loading={isLoadingScreen ? "true" : undefined}
            onClick={handleCanvasClick}
            onPointerDown={startMarquee}
            onPointerMove={handleCanvasPointerMove}
            onPointerLeave={previewMode ? undefined : () => setHoveredId(null)}
            onContextMenu={handleCanvasContextMenu}
            onContextMenuCapture={handleCanvasContextMenuCapture}
            onKeyDown={() => {}}
            className={cn(
              "relative",
              !isGameMenu && !chromeIntegratedBg && "border shadow-2xl",
              !previewMode && "outline-none focus:outline-none focus-visible:outline-none",
              isGameMenu && "rounded-none border-0 shadow-none",
              !isGameMenu &&
                (isLauncherChrome
                  ? cn(
                      "rounded-xl",
                      !chromeIntegratedBg && "border-[var(--color-border)]"
                    )
                  : cn(
                      "rounded-b-xl",
                      !chromeIntegratedBg && "border-[var(--color-border)]"
                    )),
              previewMode && !chromeIntegratedBg && !isGameMenu && "ring-2 ring-[var(--color-accent-muted)]/20"
            )}
            style={{
              width: viewport.canvasWidth,
              height: viewport.canvasHeight,
              overflow: scrollMode ? "visible" : "hidden",
              ...(isGameMenu ? { ["--gm-ui-scale" as string]: 1 } : {}),
              ...screenBackgroundStyle,
            }}
          >
          {canvasGrid && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-[1]"
              style={gridOverlayStyle}
            />
          )}
          {isGameMenu && (
            <GameMenuDecor width={viewport.canvasWidth} height={viewport.canvasHeight} />
          )}
          {isLoadingScreen && (
            <GameLoadingDecor
              width={viewport.canvasWidth}
              height={viewport.canvasHeight}
              backgroundColor={canvasScreen.backgroundColor}
              backgroundImage={canvasScreen.backgroundImage}
            />
          )}
          {!previewMode && marquee && (
            <div
              className="pointer-events-none absolute z-[9999] rounded-md border border-[var(--color-accent)] bg-[var(--color-accent)]/10"
              style={{
                left: marquee.x,
                top: marquee.y,
                width: marquee.w,
                height: marquee.h,
              }}
            />
          )}
          {!previewMode && chatGroupBounds && (
            <div
              className="hub-builder-chat-group-frame pointer-events-none absolute z-[7500]"
              style={{
                left: chatGroupBounds.x,
                top: chatGroupBounds.y,
                width: chatGroupBounds.width,
                height: chatGroupBounds.height,
              }}
            >
              <span className="hub-builder-chat-group-label">Panel de chat (visible al abrir la burbuja)</span>
            </div>
          )}
          <HubPreviewToasts />
          <HubCssElementsProvider elements={canvasScreen.elements}>
          <HubAdvancedCssSheet elements={canvasScreen.elements} />

          {editableElements.map((element) => {
            const isSelected = (selectedIds?.length ? selectedIds : selectedId ? [selectedId] : []).includes(element.id);
            const isFlashing = elementFocusFlash?.elementId === element.id;
            const isActive = dragging?.id === element.id || resizing?.id === element.id;
            const showHandles = !previewMode && isSelected && !element.locked;
            const pos = elementAbsolutePosition(canvasScreen.elements, element.id);
            const anchorPos =
              isMinecraftScreen && minecraftGuiCanvas ? resolveMinecraftRenderPos(element) : null;
            const renderX = anchorPos?.x ?? pos.x;
            const renderY = anchorPos?.y ?? pos.y;
            const renderW = anchorPos?.width ?? element.width;
            const renderH = anchorPos?.height ?? element.height;
            const elementRadius = isMinecraftScreen ? 0 : (element.style.borderRadius ?? (isLauncherChrome ? 6 : 8));

            return (
              <div
                key={element.id}
                data-hub-el="true"
                data-element-id={element.id}
                className={cn(
                  previewMode ? "touch-auto" : "touch-none pointer-events-auto",
                  !previewMode && "hub-builder-el-interactive",
                  !previewMode && isSelected && "hub-builder-el-selected",
                  !previewMode && isFlashing && "hub-builder-el-flash",
                  !previewMode && isActive && "hub-builder-el-active",
                  !previewMode && hoveredId === element.id && "hub-builder-el-hovered"
                )}
                onPointerDown={
                  previewMode ? undefined : (e) => handleElementPointerDown(e, element.id)
                }
                style={{
                  position: "absolute",
                  left: renderX,
                  top: renderY,
                  width: renderW,
                  height: renderH,
                  zIndex: resolveEditorCanvasZIndex(canvasScreen.elements, element) + (isMinecraftScreen ? 3 : 0),
                  borderRadius: elementRadius,
                }}
              >
                <div className="relative h-full w-full pointer-events-none">
                  {!previewMode && hasLogicBadge(element) && (
                    <LogicBadge label={logicBadgeLabel(element)} />
                  )}
                  <HubElementView
                    element={element}
                    selected={isSelected}
                    editing={!previewMode}
                    runtime={previewMode || isMinecraftScreen}
                    fillParent
                    onRuntimeClick={() => void executeElementAction(element.id)}
                    onRuntimeChange={(value) => void handleRuntimeChange(element.id, value)}
                  />
                </div>
                {showHandles && (
                  <ResizeHandles
                    width={renderW}
                    height={renderH}
                    borderRadius={elementRadius}
                    onStart={(e, handle) => startResize(e, element.id, handle)}
                  />
                )}
              </div>
            );
          })}
          </HubCssElementsProvider>
          </div>
        </div>
        {previewMode && minecraftSimWindow && (
          <PreviewFrameResizer
            width={minecraftSimWindow.width}
            height={minecraftSimWindow.height}
            minWidth={isMinecraftScreen ? 320 : 400}
            minHeight={isMinecraftScreen ? 180 : 240}
            onResize={(width, height) => setPreviewFrameSize({ width, height })}
          />
        )}
        </div>
      </div>
    </div>
  );
}
