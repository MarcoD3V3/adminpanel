"use client";

import { cn } from "@/lib/utils";
import { clampElement, snapCenterAxis } from "@/lib/hub-builder-data";
import { resolveEditorSnapGridSize } from "@/lib/hub-editor-canvas-settings";
import { useHubBuilderStore } from "@/lib/hub-builder-store";
import { useActiveScreen, useSelectedElement } from "@/components/hub-builder/hub-builder-hooks";
import {
  AlignHorizontalJustifyCenter,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  ClipboardPaste,
  Copy,
  Crosshair,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";

interface RibbonGroupProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

function RibbonGroup({ label, children, className }: RibbonGroupProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col justify-between border-r border-[var(--color-border-subtle)] px-2 py-1.5 last:border-r-0",
        className
      )}
    >
      <div className="flex items-center gap-0.5">{children}</div>
      <span className="mt-1 text-center text-[8px] uppercase tracking-widest text-[var(--color-muted)]">
        {label}
      </span>
    </div>
  );
}

interface RibbonIconBtnProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
}

function RibbonIconBtn({ icon, label, shortcut, onClick, disabled, danger, active }: RibbonIconBtnProps) {
  const title = shortcut ? `${label} (${shortcut})` : label;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors",
        disabled && "cursor-not-allowed opacity-35",
        !disabled && danger && "text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)]",
        !disabled && !danger && active && "bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
        !disabled &&
          !danger &&
          !active &&
          "text-[var(--color-text-soft)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
      )}
    >
      {icon}
    </button>
  );
}

function SelectionPanel() {
  const element = useSelectedElement();
  const screen = useActiveScreen();
  const selectedId = useHubBuilderStore((s) => s.selectedId);
  const updateElement = useHubBuilderStore((s) => s.updateElement);

  if (!element) {
    const onCanvas = screen.elements.filter((e) => !e.parentId).length;
    const nested = screen.elements.length - onCanvas;
    return (
      <div className="flex h-[52px] w-[184px] shrink-0 flex-col justify-center border-r border-[var(--color-border-subtle)] px-3">
        <span className="text-[11px] text-[var(--color-text-soft)]">Sin selección</span>
        <span className="text-[10px] text-[var(--color-muted)]">
          {onCanvas} en lienzo
          {nested > 0 ? ` · ${screen.elements.length} total` : ` · ${screen.elements.length} elementos`}
        </span>
      </div>
    );
  }

  const displayName = element.label?.trim() || element.type;

  return (
    <div className="flex h-[52px] w-[184px] shrink-0 flex-col justify-center gap-0.5 border-r border-[var(--color-border-subtle)] px-3">
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0 rounded bg-[var(--color-surface-hover)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-[var(--color-muted)]">
          {element.type}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            title="Bajar capa (z-index)"
            disabled={element.zIndex <= 0}
            onClick={() => selectedId && updateElement(selectedId, { zIndex: Math.max(0, element.zIndex - 1) })}
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--color-muted)] hover:bg-[var(--color-surface-hover)] disabled:opacity-30"
          >
            <Minus className="h-3 w-3" strokeWidth={1.5} />
          </button>
          <span className="w-5 text-center font-mono text-[9px] text-[var(--color-muted)]">z{element.zIndex}</span>
          <button
            type="button"
            title="Subir capa (z-index)"
            onClick={() => selectedId && updateElement(selectedId, { zIndex: element.zIndex + 1 })}
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--color-muted)] hover:bg-[var(--color-surface-hover)]"
          >
            <Plus className="h-3 w-3" strokeWidth={1.5} />
          </button>
        </div>
      </div>
      <p
        className="line-clamp-2 text-[11px] leading-snug text-[var(--color-text)]"
        title={displayName}
      >
        {displayName}
      </p>
      <p className="font-mono text-[9px] text-[var(--color-muted)]">
        {element.width}×{element.height}
      </p>
    </div>
  );
}

const SHORTCUTS = [
  { keys: "↑↓←→", tip: "Mover elemento" },
  { keys: "Tab", tip: "Seleccionar siguiente" },
  { keys: "Del", tip: "Eliminar" },
  { keys: "Ctrl+Z", tip: "Deshacer" },
  { keys: "Ctrl+S", tip: "Guardar" },
] as const;

export function ElementToolbar() {
  const selectedId = useHubBuilderStore((s) => s.selectedId);
  const selectedIds = useHubBuilderStore((s) => s.selectedIds);
  const clipboard = useHubBuilderStore((s) => s.clipboard);
  const element = useSelectedElement();
  const duplicateElement = useHubBuilderStore((s) => s.duplicateElement);
  const copyElement = useHubBuilderStore((s) => s.copyElement);
  const pasteElement = useHubBuilderStore((s) => s.pasteElement);
  const removeElement = useHubBuilderStore((s) => s.removeElement);
  const removeElements = useHubBuilderStore((s) => s.removeElements);
  const reorderElement = useHubBuilderStore((s) => s.reorderElement);
  const bringToFront = useHubBuilderStore((s) => s.bringToFront);
  const sendToBack = useHubBuilderStore((s) => s.sendToBack);
  const alignElement = useHubBuilderStore((s) => s.alignElement);
  const toggleLock = useHubBuilderStore((s) => s.toggleLock);
  const toggleVisible = useHubBuilderStore((s) => s.toggleVisible);

  const hasSelection = !!element;
  const isLocked = element?.locked ?? false;

  const centerOnCanvas = () => {
    if (!selectedId) return;
    const store = useHubBuilderStore.getState();
    store.pushHistory();
    const screen = store.getActiveScreen();
    const el = screen.elements.find((e) => e.id === selectedId);
    if (!el || el.locked) return;
    const grid = resolveEditorSnapGridSize(store.editTarget, store.editorCanvasSettings);
    const boundsW = screen.width;
    const boundsH = screen.height;
    const x = snapCenterAxis(boundsW, el.width, grid);
    const y = snapCenterAxis(boundsH, el.height, grid);
    const clamped = clampElement(x, y, el.width, el.height, boundsW, boundsH);
    store.updateElement(selectedId, { x: clamped.x, y: clamped.y });
  };

  return (
    <div className="shrink-0 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]">
      {/* Fila principal — altura fija */}
      <div className="flex h-[68px] items-stretch overflow-x-auto">
        <SelectionPanel />

        <RibbonGroup label="Portapapeles">
          <RibbonIconBtn
            icon={<Copy className="h-3.5 w-3.5" strokeWidth={1.5} />}
            label="Copiar"
            shortcut="Ctrl+C"
            disabled={!hasSelection}
            onClick={() => selectedId && copyElement(selectedId)}
          />
          <RibbonIconBtn
            icon={<ClipboardPaste className="h-3.5 w-3.5" strokeWidth={1.5} />}
            label="Pegar"
            shortcut="Ctrl+V"
            disabled={!clipboard}
            onClick={pasteElement}
          />
          <RibbonIconBtn
            icon={<Copy className="h-3.5 w-3.5" strokeWidth={1.5} />}
            label="Duplicar"
            shortcut="Ctrl+D"
            disabled={!hasSelection}
            onClick={() => selectedId && duplicateElement(selectedId)}
          />
          <RibbonIconBtn
            icon={<Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />}
            label="Eliminar"
            shortcut="Del"
            disabled={!hasSelection}
            danger
            onClick={() => {
              if (selectedIds?.length) return removeElements(selectedIds);
              if (selectedId) return removeElement(selectedId);
            }}
          />
        </RibbonGroup>

        <RibbonGroup label="Capas">
          <RibbonIconBtn
            icon={<ArrowUp className="h-3.5 w-3.5" strokeWidth={1.5} />}
            label="Subir capa"
            shortcut="Ctrl+]"
            disabled={!hasSelection}
            onClick={() => selectedId && reorderElement(selectedId, "up")}
          />
          <RibbonIconBtn
            icon={<ArrowDown className="h-3.5 w-3.5" strokeWidth={1.5} />}
            label="Bajar capa"
            shortcut="Ctrl+["
            disabled={!hasSelection}
            onClick={() => selectedId && reorderElement(selectedId, "down")}
          />
          <RibbonIconBtn
            icon={<ArrowUpToLine className="h-3.5 w-3.5" strokeWidth={1.5} />}
            label="Al frente"
            shortcut="Ctrl+Shift+]"
            disabled={!hasSelection}
            onClick={() => selectedId && bringToFront(selectedId)}
          />
          <RibbonIconBtn
            icon={<ArrowDownToLine className="h-3.5 w-3.5" strokeWidth={1.5} />}
            label="Al fondo"
            shortcut="Ctrl+Shift+["
            disabled={!hasSelection}
            onClick={() => selectedId && sendToBack(selectedId)}
          />
        </RibbonGroup>

        <RibbonGroup label="Horizontal">
          <RibbonIconBtn
            icon={<AlignLeft className="h-3.5 w-3.5" strokeWidth={1.5} />}
            label="Alinear izquierda"
            disabled={!hasSelection || isLocked}
            onClick={() => selectedId && alignElement(selectedId, "left")}
          />
          <RibbonIconBtn
            icon={<AlignHorizontalJustifyCenter className="h-3.5 w-3.5" strokeWidth={1.5} />}
            label="Centrar horizontal"
            disabled={!hasSelection || isLocked}
            onClick={() => selectedId && alignElement(selectedId, "center-h")}
          />
          <RibbonIconBtn
            icon={<AlignRight className="h-3.5 w-3.5" strokeWidth={1.5} />}
            label="Alinear derecha"
            disabled={!hasSelection || isLocked}
            onClick={() => selectedId && alignElement(selectedId, "right")}
          />
        </RibbonGroup>

        <RibbonGroup label="Vertical">
          <RibbonIconBtn
            icon={<AlignStartVertical className="h-3.5 w-3.5" strokeWidth={1.5} />}
            label="Alinear arriba"
            disabled={!hasSelection || isLocked}
            onClick={() => selectedId && alignElement(selectedId, "top")}
          />
          <RibbonIconBtn
            icon={<AlignVerticalJustifyCenter className="h-3.5 w-3.5" strokeWidth={1.5} />}
            label="Centrar vertical"
            disabled={!hasSelection || isLocked}
            onClick={() => selectedId && alignElement(selectedId, "center-v")}
          />
          <RibbonIconBtn
            icon={<AlignVerticalJustifyEnd className="h-3.5 w-3.5" strokeWidth={1.5} />}
            label="Alinear abajo"
            disabled={!hasSelection || isLocked}
            onClick={() => selectedId && alignElement(selectedId, "bottom")}
          />
        </RibbonGroup>

        <RibbonGroup label="Centro">
          <RibbonIconBtn
            icon={<Crosshair className="h-3.5 w-3.5" strokeWidth={1.5} />}
            label="Centrar en canvas"
            disabled={!hasSelection || isLocked}
            onClick={centerOnCanvas}
          />
        </RibbonGroup>

        <RibbonGroup label="Estado">
          <RibbonIconBtn
            icon={
              element?.visible !== false ? (
                <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
              ) : (
                <EyeOff className="h-3.5 w-3.5" strokeWidth={1.5} />
              )
            }
            label="Visible"
            shortcut="Ctrl+H"
            disabled={!hasSelection}
            active={element?.visible !== false}
            onClick={() => selectedId && toggleVisible(selectedId)}
          />
          <RibbonIconBtn
            icon={
              isLocked ? (
                <Lock className="h-3.5 w-3.5" strokeWidth={1.5} />
              ) : (
                <LockOpen className="h-3.5 w-3.5" strokeWidth={1.5} />
              )
            }
            label="Bloquear"
            shortcut="Ctrl+L"
            disabled={!hasSelection}
            active={isLocked}
            onClick={() => selectedId && toggleLock(selectedId)}
          />
        </RibbonGroup>
      </div>

      {/* Atajos — fila separada, sin recortes */}
      <div className="flex h-7 items-center gap-3 overflow-x-auto border-t border-[var(--color-border-subtle)]/60 px-3">
        <span className="shrink-0 text-[9px] uppercase tracking-widest text-[var(--color-muted)]">Atajos</span>
        {SHORTCUTS.map((s) => (
          <span
            key={s.keys}
            title={s.tip}
            className="flex shrink-0 items-center gap-1.5 text-[10px] text-[var(--color-text-soft)]"
          >
            <kbd className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--color-muted)]">
              {s.keys}
            </kbd>
            <span className="hidden text-[var(--color-muted)] sm:inline">{s.tip}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
