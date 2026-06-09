"use client";

import type { MouseEvent } from "react";
import { Copy, Plus, Star, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isAccountHubScreen, isHomeScreen } from "@craftlauncher/shared";
import { useHubBuilderStore } from "@/lib/hub-builder-store";
import { GAME_MENU_SCREEN_ID } from "@/lib/game-ui-export";
import { GAME_LOADING_SCREEN_ID } from "@/lib/loading-ui-export";

const MINECRAFT_EDITOR_SCREEN_IDS = new Set([GAME_MENU_SCREEN_ID, GAME_LOADING_SCREEN_ID]);

export function ScreenBar() {
  const layout = useHubBuilderStore((s) => s.layout);
  const activeScreenId = layout.activeScreenId;
  const editTarget = useHubBuilderStore((s) => s.editTarget);
  const setActiveScreen = useHubBuilderStore((s) => s.setActiveScreen);
  const setEditTarget = useHubBuilderStore((s) => s.setEditTarget);
  const addScreen = useHubBuilderStore((s) => s.addScreen);
  const removeScreen = useHubBuilderStore((s) => s.removeScreen);
  const duplicateScreen = useHubBuilderStore((s) => s.duplicateScreen);
  const openContextMenu = useHubBuilderStore((s) => s.openContextMenu);

  const openScreenMenu = (screenId: string, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu({
      open: true,
      x: e.clientX,
      y: e.clientY,
      target: "screen",
      screenId,
    });
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
        Ventanas
      </span>

      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overflow-y-hidden pr-1">
        {layout.screens.filter((s) => !MINECRAFT_EDITOR_SCREEN_IDS.has(s.id)).map((s) => {
          const isActive = activeScreenId === s.id;
          const isMain = isHomeScreen(layout, s.id);
          const isAccount = isAccountHubScreen(s);
          return (
            <div
              key={s.id}
              className={cn(
                "group flex shrink-0 items-center overflow-hidden rounded-lg border text-xs transition-colors",
                isActive
                  ? "border-[var(--color-accent-muted)] bg-[var(--color-surface-raised)]"
                  : "border-[var(--color-border-subtle)] bg-transparent hover:border-[var(--color-border)]"
              )}
              onContextMenu={(e) => openScreenMenu(s.id, e)}
            >
              <button
                type="button"
                onClick={() => {
                  setEditTarget("screen");
                  setActiveScreen(s.id);
                }}
                className={cn(
                  "flex max-w-[128px] items-center gap-1 truncate px-2.5 py-1.5",
                  isActive
                    ? "text-[var(--color-text)]"
                    : "text-[var(--color-muted)] hover:text-[var(--color-text-soft)]"
                )}
                title={
                  isMain
                    ? `${s.name} · Principal al abrir launcher · ID: ${s.id}`
                    : isAccount
                      ? `${s.name} · Ventana Perfil/Cuenta · ID: ${s.id}`
                      : `${s.name} · ID: ${s.id} · Clic derecho para opciones`
                }
              >
                {isMain && (
                  <Star
                    className="h-3 w-3 shrink-0 fill-[var(--color-accent)] text-[var(--color-accent)]"
                    strokeWidth={1.5}
                  />
                )}
                {!isMain && isAccount && (
                  <User
                    className="h-3 w-3 shrink-0 text-[var(--color-accent)]"
                    strokeWidth={1.5}
                  />
                )}
                <span className="truncate">{s.name}</span>
              </button>
              <button
                type="button"
                onClick={() => duplicateScreen(s.id)}
                className="border-l border-[var(--color-border-subtle)] px-1.5 py-1.5 text-[var(--color-muted)] opacity-70 transition-opacity hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-soft)] hover:opacity-100"
                title="Duplicar ventana"
              >
                <Copy className="h-3 w-3" strokeWidth={1.5} />
              </button>
              {layout.screens.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeScreen(s.id)}
                  className="border-l border-[var(--color-border-subtle)] px-1.5 py-1.5 text-[var(--color-muted)] opacity-70 transition-opacity hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger-text)] hover:opacity-100"
                  title="Eliminar ventana"
                >
                  <X className="h-3 w-3" strokeWidth={1.5} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setEditTarget("launcher-chrome")}
        className={cn(
          "flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors",
          editTarget === "launcher-chrome"
            ? "border-[var(--color-accent-muted)] bg-[var(--color-surface-raised)] text-[var(--color-text)]"
            : "border-[var(--color-border-subtle)] text-[var(--color-muted)] hover:border-[var(--color-border)] hover:text-[var(--color-text-soft)]"
        )}
        title={`Barra superior de «${layout.screens.find((s) => s.id === activeScreenId)?.name ?? "ventana"}»`}
      >
        Barra superior
      </button>

      <button
        type="button"
        onClick={() => addScreen()}
        className="flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-[var(--color-border-subtle)] px-2.5 py-1.5 text-[11px] text-[var(--color-muted)] transition-colors hover:border-[var(--color-accent-muted)] hover:text-[var(--color-accent)]"
        title="Crear nueva ventana"
      >
        <Plus className="h-3 w-3" strokeWidth={1.5} />
        Nueva
      </button>
    </div>
  );
}
