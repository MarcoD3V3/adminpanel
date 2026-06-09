"use client";

import { RESIZE_HANDLES, type ResizeHandle } from "@/lib/hub-builder-data";
import { resizeHandleCenter } from "@/components/hub-builder/hub-resize-handle-layout";

interface ResizeHandlesProps {
  width: number;
  height: number;
  borderRadius: number;
  onStart: (e: React.PointerEvent, handle: ResizeHandle) => void;
}

export function ResizeHandles({ width, height, borderRadius, onStart }: ResizeHandlesProps) {
  return (
    <div
      className="hub-builder-resize-handles pointer-events-none absolute inset-0 z-10"
      style={{ borderRadius: "inherit" }}
    >
      {RESIZE_HANDLES.map(({ id, cursor }) => {
        const { x, y } = resizeHandleCenter(id, width, height, borderRadius);
        return (
          <div
            key={id}
            role="presentation"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onStart(e, id);
            }}
            className="hub-builder-resize-handle pointer-events-auto absolute h-[3px] w-[3px] rounded-full bg-[var(--color-accent)]/55"
            style={{
              left: x,
              top: y,
              transform: "translate(-50%, -50%)",
              cursor,
              boxShadow: "0 0 0 1px rgba(12, 14, 17, 0.85)",
            }}
          />
        );
      })}
    </div>
  );
}
