"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

type PreviewFrameResizerProps = {
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  onResize: (width: number, height: number) => void;
  className?: string;
};

/** Asas para redimensionar la ventana simulada en modo probar. */
export function PreviewFrameResizer({
  width,
  height,
  minWidth = 320,
  minHeight = 200,
  onResize,
  className,
}: PreviewFrameResizerProps) {
  const dragRef = useRef<{
    pointerId: number;
    edge: "se" | "e" | "s";
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  const start = useCallback(
    (edge: "se" | "e" | "s", e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        pointerId: e.pointerId,
        edge,
        startX: e.clientX,
        startY: e.clientY,
        startW: width,
        startH: height,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const s = dragRef.current;
        if (!s || s.pointerId !== ev.pointerId) return;
        const dx = ev.clientX - s.startX;
        const dy = ev.clientY - s.startY;
        let nw = s.startW;
        let nh = s.startH;
        if (s.edge === "se" || s.edge === "e") nw = s.startW + dx;
        if (s.edge === "se" || s.edge === "s") nh = s.startH + dy;
        onResize(Math.max(minWidth, Math.round(nw)), Math.max(minHeight, Math.round(nh)));
      };

      const onUp = (ev: PointerEvent) => {
        const s = dragRef.current;
        if (!s || s.pointerId !== ev.pointerId) return;
        dragRef.current = null;
        cleanup();
      };

      const cleanup = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [height, minHeight, minWidth, onResize, width]
  );

  const handleCls =
    "absolute z-40 touch-none bg-[var(--color-accent)]/25 hover:bg-[var(--color-accent)]/45";

  return (
    <div className={cn("pointer-events-none absolute inset-0", className)} aria-hidden>
      <div
        className={cn(handleCls, "right-0 top-1/2 h-10 w-1.5 -translate-y-1/2 cursor-ew-resize rounded-l")}
        style={{ pointerEvents: "auto" }}
        onPointerDown={(e) => start("e", e)}
      />
      <div
        className={cn(handleCls, "bottom-0 left-1/2 h-1.5 w-10 -translate-x-1/2 cursor-ns-resize rounded-t")}
        style={{ pointerEvents: "auto" }}
        onPointerDown={(e) => start("s", e)}
      />
      <div
        className={cn(handleCls, "bottom-0 right-0 h-3 w-3 cursor-nwse-resize rounded-tl")}
        style={{ pointerEvents: "auto" }}
        onPointerDown={(e) => start("se", e)}
      />
      <div
        className="pointer-events-none absolute bottom-1 right-2 text-[9px] font-mono text-[var(--color-muted)]"
      >
        {width}×{height}
      </div>
    </div>
  );
}
