"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHubBuilderStore } from "@/lib/hub-builder-store";
import { getContextMenuItems } from "@/components/hub-builder/context-menu-items";

export interface MenuItemDef {
  id: string;
  label?: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  checked?: boolean;
  separator?: boolean;
  onClick?: () => void;
  children?: MenuItemDef[];
}

interface SubMenuPanelProps {
  items: MenuItemDef[];
  depth: number;
  parentRect: DOMRect | null;
  onClose: () => void;
}

function SubMenuPanel({ items, depth, parentRect, onClose }: SubMenuPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [subAnchor, setSubAnchor] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!parentRect || !ref.current) return;
    const menu = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = depth === 0 ? parentRect.left : parentRect.right - 4;
    let top = parentRect.top;

    if (left + menu.width > vw - 8) {
      left = depth === 0 ? parentRect.left - menu.width : parentRect.left - menu.width + 4;
    }
    if (top + menu.height > vh - 8) top = vh - menu.height - 8;
    if (top < 8) top = 8;
    if (left < 8) left = 8;

    setPos({ top, left });
  }, [parentRect, depth, items]);

  const hoveredItem = items.find((i) => i.id === hoverId);

  return (
    <>
      <div
        ref={ref}
        className="fixed z-[9999] min-w-[200px] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] py-1 shadow-xl"
        data-hub-context-menu
        style={{ top: pos.top, left: pos.left }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {items.map((item) => {
          if (item.separator) {
            return <div key={item.id} className="my-1 h-px bg-[var(--color-border-subtle)]" />;
          }

          const Icon = item.icon;
          const hasChildren = item.children && item.children.length > 0;

          return (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              onMouseEnter={(e) => {
                setHoverId(item.id);
                setSubAnchor(e.currentTarget.getBoundingClientRect());
              }}
              onClick={() => {
                if (hasChildren || item.disabled) return;
                item.onClick?.();
                onClose();
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors",
                item.disabled && "cursor-not-allowed opacity-40",
                !item.disabled && item.danger && "text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)]",
                !item.disabled && !item.danger && "text-[var(--color-text-soft)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]",
                hoverId === item.id && !item.danger && "bg-[var(--color-surface-hover)] text-[var(--color-text)]"
              )}
            >
              {Icon && <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={1.5} />}
              {!Icon && <span className="w-3.5 shrink-0" />}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.checked && <span className="text-[var(--color-accent)]">✓</span>}
              {item.shortcut && (
                <span className="shrink-0 text-[10px] text-[var(--color-muted)]">{item.shortcut}</span>
              )}
              {hasChildren && <ChevronRight className="h-3 w-3 shrink-0 text-[var(--color-muted)]" strokeWidth={1.5} />}
            </button>
          );
        })}
      </div>

      {hoveredItem?.children && subAnchor && (
        <SubMenuPanel
          items={hoveredItem.children}
          depth={depth + 1}
          parentRect={subAnchor}
          onClose={onClose}
        />
      )}
    </>
  );
}

export function HubContextMenu() {
  const contextMenu = useHubBuilderStore((s) => s.contextMenu);
  const closeContextMenu = useHubBuilderStore((s) => s.closeContextMenu);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!contextMenu?.open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeContextMenu();
    };

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      const menus = document.querySelectorAll("[data-hub-context-menu]");
      for (const menu of menus) {
        if (menu.contains(target)) return;
      }
      closeContextMenu();
    };

    window.addEventListener("keydown", onKey);
    // Capture: cierra antes de stopPropagation en canvas/elementos
    window.addEventListener("pointerdown", onPointerDown, true);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [contextMenu?.open, contextMenu?.x, contextMenu?.y, closeContextMenu]);

  if (!mounted || !contextMenu?.open) return null;

  const items = getContextMenuItems();
  if (items.length === 0) return null;

  const anchorRect = new DOMRect(contextMenu.x, contextMenu.y, 0, 0);

  return createPortal(
    <SubMenuPanel
      key={`${contextMenu.x}-${contextMenu.y}-${contextMenu.target}-${contextMenu.elementId ?? ""}-${contextMenu.screenId ?? ""}`}
      items={items}
      depth={0}
      parentRect={anchorRect}
      onClose={closeContextMenu}
    />,
    document.body
  );
}
