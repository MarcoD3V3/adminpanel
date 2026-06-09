"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type HubSelectOption = { value: string; label: string };

type HubSelectProps = {
  label?: string;
  value: string;
  options: HubSelectOption[];
  compact?: boolean;
  className?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

type MenuPos = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const MENU_GAP = 4;
const MENU_MAX_HEIGHT = 240;

export function HubSelect({
  label,
  value,
  options,
  compact,
  className,
  disabled,
  onChange,
}: HubSelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);

  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => setMounted(true), []);

  const updateMenuPos = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
    const spaceAbove = rect.top - MENU_GAP;
    const openAbove = spaceBelow < 160 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(
      MENU_MAX_HEIGHT,
      Math.max(120, openAbove ? spaceAbove : spaceBelow)
    );
    setMenuPos({
      left: rect.left,
      width: rect.width,
      top: openAbove ? rect.top - MENU_GAP - maxHeight : rect.bottom + MENU_GAP,
      maxHeight,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPos();
  }, [open, updateMenuPos]);

  useEffect(() => {
    if (!open) return;

    const onScrollOrResize = () => updateMenuPos();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, updateMenuPos]);

  const handlePick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div className={cn(compact ? "space-y-1" : "space-y-1.5", className)}>
      {label && (
        <p
          className={cn(
            "font-medium text-[var(--color-text-soft)]",
            compact ? "text-[10px]" : "text-xs"
          )}
        >
          {label}
        </p>
      )}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        className={cn(
          "flex w-full items-center justify-between gap-2 border border-[var(--color-border)] bg-[var(--color-surface)] text-left text-[var(--color-text)] outline-none transition-colors",
          "hover:border-[var(--color-border-subtle)] focus:border-[var(--color-accent-muted)]",
          open && "border-[var(--color-accent-muted)]",
          compact ? "rounded-lg px-2 py-1.5 text-xs" : "rounded-xl px-3.5 py-2.5 text-sm",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <span className="min-w-0 truncate">{selected?.label ?? value}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-[var(--color-muted)] transition-transform",
            open && "rotate-180"
          )}
          strokeWidth={1.5}
        />
      </button>

      {mounted &&
        open &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            className="fixed z-[400] overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-xl"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="max-h-[inherit] overflow-y-auto overscroll-contain py-0.5">
              {options.map((opt) => {
                const active = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    title={opt.label}
                    className={cn(
                      "flex w-full px-2.5 py-1.5 text-left transition-colors",
                      compact ? "text-xs" : "text-sm",
                      active
                        ? "bg-[var(--color-surface-hover)] text-[var(--color-text)]"
                        : "text-[var(--color-text-soft)] hover:bg-[var(--color-surface-hover)]/80"
                    )}
                    onClick={() => handlePick(opt.value)}
                  >
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
