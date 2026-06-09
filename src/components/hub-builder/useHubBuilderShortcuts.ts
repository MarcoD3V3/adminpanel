"use client";

import { useEffect } from "react";
import { resolveEditorSnapGridSize } from "@/lib/hub-editor-canvas-settings";
import { useHubBuilderStore } from "@/lib/hub-builder-store";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

interface UseHubBuilderShortcutsOptions {
  onSave?: () => void;
  disabled?: boolean;
}

export function useHubBuilderShortcuts({ onSave, disabled }: UseHubBuilderShortcutsOptions = {}) {
  useEffect(() => {
    if (disabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      const store = useHubBuilderStore.getState();
      const { selectedId, selectedIds } = store;
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        store.undo();
        return;
      }

      if ((mod && e.key === "y") || (mod && e.shiftKey && e.key === "z")) {
        e.preventDefault();
        store.redo();
        return;
      }

      if (mod && e.key === "s") {
        e.preventDefault();
        onSave?.();
        return;
      }

      if (mod && e.key === "c" && selectedId) {
        e.preventDefault();
        store.copyElement(selectedId);
        return;
      }

      if (mod && e.key === "v") {
        e.preventDefault();
        store.pasteElement();
        return;
      }

      if (mod && e.key === "d" && selectedId) {
        e.preventDefault();
        store.duplicateElement(selectedId);
        return;
      }

      if (mod && e.key === "l" && selectedId) {
        e.preventDefault();
        store.toggleLock(selectedId);
        return;
      }

      if (mod && e.key === "h" && selectedId) {
        e.preventDefault();
        store.toggleVisible(selectedId);
        return;
      }

      if (mod && e.shiftKey && e.key === "]" && selectedId) {
        e.preventDefault();
        store.bringToFront(selectedId);
        return;
      }

      if (mod && e.shiftKey && e.key === "[" && selectedId) {
        e.preventDefault();
        store.sendToBack(selectedId);
        return;
      }

      if (mod && !e.shiftKey && e.key === "]" && selectedId) {
        e.preventDefault();
        store.reorderElement(selectedId, "up");
        return;
      }

      if (mod && !e.shiftKey && e.key === "[" && selectedId) {
        e.preventDefault();
        store.reorderElement(selectedId, "down");
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds?.length) {
          e.preventDefault();
          store.removeElements(selectedIds);
        } else if (selectedId) {
          e.preventDefault();
          store.removeElement(selectedId);
        }
        return;
      }

      if (e.key === "Escape") {
        store.selectElement(null);
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        store.selectNextElement(e.shiftKey ? -1 : 1);
        return;
      }

      if (selectedId && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : resolveEditorSnapGridSize(store.editTarget, store.editorCanvasSettings);
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        store.nudgeElement(selectedId, dx, dy);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSave, disabled]);
}
