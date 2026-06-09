"use client";

import { useMemo, useState } from "react";
import { elementPalette, paletteCategoryLabels } from "@/lib/hub-builder-data";
import {
  gameMenuPalette,
  gameMenuCategoryLabels,
  GAME_MENU_PALETTE_ORDER,
  type GameMenuPaletteCategory,
  type GameMenuPaletteItem,
} from "@/lib/game-menu-palette";
import {
  loadingPalette,
  loadingCategoryLabels,
  LOADING_PALETTE_ORDER,
  type LoadingPaletteCategory,
  type LoadingPaletteItem,
} from "@/lib/loading-menu-palette";
import { GAME_MENU_SCREEN_ID } from "@/lib/game-ui-export";
import { GAME_LOADING_SCREEN_ID } from "@/lib/loading-ui-export";
import type { PaletteCategory, PaletteItem } from "@/types/hub-builder";
import { useHubBuilderStore } from "@/lib/hub-builder-store";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  Coins,
  Gift,
  Grid3X3,
  Home,
  Image,
  Link2,
  Percent,
  Search,
  ShoppingCart,
  Square,
  Type,
  User,
  Users,
} from "lucide-react";

const CATEGORY_ORDER: PaletteCategory[] = [
  "chrome",
  "basic",
  "content",
  "layout",
  "logic",
  "instances",
  "account",
  "launch",
  "settings",
  "mods",
];

function paletteTargetsChrome(item: { category: string; chromeTarget?: boolean }): boolean {
  return item.category === "chrome" || Boolean(item.chromeTarget);
}

function matchesPaletteQuery(item: PaletteItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const cat = paletteCategoryLabels[item.category]?.toLowerCase() ?? item.category;
  return (
    item.label.toLowerCase().includes(q) ||
    item.description.toLowerCase().includes(q) ||
    item.id.toLowerCase().includes(q) ||
    item.type.toLowerCase().includes(q) ||
    cat.includes(q)
  );
}

function GameMenuPaletteIcon({ item }: { item: GameMenuPaletteItem }) {
  const t = item.type;
  const Icon =
    t === "text" || t === "launch-hint-text"
      ? Type
      : t === "link"
        ? Link2
        : t === "play-button"
          ? Home
          : t === "profile-widget" || t === "instance-avatar"
            ? User
            : t === "chip"
              ? Coins
              : t === "news-card"
                ? Gift
                : t === "banner"
                  ? ShoppingCart
                  : t === "container" || t === "surface-box"
                    ? Grid3X3
                    : t === "nav-item" || t === "icon-button"
                      ? Square
                      : t === "image"
                        ? Image
                        : item.id.includes("multi")
                          ? Users
                          : Square;
  const bg =
    item.category === "game-widgets"
      ? "#16181c"
      : item.category === "game-top-bar"
        ? "#1e2126"
        : "#2b2e33";
  return (
    <div
      className="flex h-full w-full items-center justify-center rounded text-[var(--color-text-soft)]"
      style={{ background: bg }}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
    </div>
  );
}

function LoadingPaletteIcon({ item }: { item: LoadingPaletteItem }) {
  const Icon =
    item.type === "text" ? Type : item.type === "launch-progress-bar" ? Percent : Square;
  return (
    <div className="flex h-full w-full items-center justify-center rounded bg-[#1a1d22] text-[var(--color-text-soft)]">
      <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
    </div>
  );
}

function PaletteItemButton({
  item,
  onAdd,
}: {
  item: PaletteItem;
  onAdd: (id: string) => void;
}) {
  return (
    <button
      type="button"
      title={`${item.label} — ${item.description}${
        paletteTargetsChrome(item) ? " · Se añade a la barra superior" : ""
      }`}
      onClick={() => onAdd(item.id)}
      className="group flex flex-col items-stretch gap-0.5 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-1 transition-colors hover:border-[var(--color-accent-muted)] hover:bg-[var(--color-surface-hover)]"
    >
      <div className="hub-palette-preview hub-palette-preview--static">
        <span className="flex h-full items-center justify-center text-[8px] text-[var(--color-muted)]">
          {item.label.slice(0, 8)}
        </span>
      </div>
      <span className="w-full truncate text-center text-[8px] leading-tight text-[var(--color-muted)] group-hover:text-[var(--color-text-soft)]">
        {item.label}
      </span>
    </button>
  );
}

interface ElementPaletteProps {
  compact?: boolean;
}

export function ElementPalette({ compact = true }: ElementPaletteProps) {
  const addElement = useHubBuilderStore((s) => s.addElement);
  const activeScreenId = useHubBuilderStore((s) => s.layout.activeScreenId);
  const isGameMenu = activeScreenId === GAME_MENU_SCREEN_ID;
  const isLoadingScreen = activeScreenId === GAME_LOADING_SCREEN_ID;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [paletteQuery, setPaletteQuery] = useState("");

  const toggleCat = (cat: string) =>
    setExpanded((s) => ({ ...s, [cat]: !s[cat] }));

  const filteredPalette = useMemo(
    () => elementPalette.filter((item) => matchesPaletteQuery(item, paletteQuery)),
    [paletteQuery]
  );

  const paletteSearchActive = paletteQuery.trim().length > 0;

  if (isLoadingScreen) {
    return (
      <div className="hub-scroll-hidden max-h-full space-y-2 overflow-y-auto">
        {!compact && (
          <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-muted)]">
            Pantalla de carga
          </p>
        )}
        {LOADING_PALETTE_ORDER.map((cat) => {
          const items = loadingPalette.filter((p) => p.category === cat);
          const isOpen = expanded[cat] === true;
          return (
            <div key={cat} className="hub-palette-category">
              <button
                type="button"
                onClick={() => toggleCat(cat)}
                className="mb-1 flex w-full items-center justify-between rounded bg-[var(--color-surface)] px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted)] hover:text-[var(--color-text-soft)]"
              >
                {loadingCategoryLabels[cat as LoadingPaletteCategory]}
                <ChevronDown
                  className={cn("h-3 w-3 shrink-0 transition-transform", !isOpen && "-rotate-90")}
                  strokeWidth={1.5}
                />
              </button>
              {isOpen && (
                <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))" }}>
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      title={`${item.label} — ${item.description}`}
                      onClick={() => addElement(item.id)}
                      className="group flex flex-col items-stretch gap-0.5 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-1 transition-colors hover:border-[var(--color-accent-muted)] hover:bg-[var(--color-surface-hover)]"
                    >
                      <div className="hub-palette-preview">
                        <LoadingPaletteIcon item={item} />
                      </div>
                      <span className="w-full truncate text-center text-[8px] leading-tight text-[var(--color-muted)] group-hover:text-[var(--color-text-soft)]">
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (isGameMenu) {
    return (
      <div className="hub-scroll-hidden max-h-full space-y-2 overflow-y-auto">
        {!compact && (
          <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-muted)]">
            Menú Minecraft · {gameMenuPalette.length} elementos
          </p>
        )}
        {GAME_MENU_PALETTE_ORDER.map((cat) => {
          const items = gameMenuPalette.filter((p) => p.category === cat);
          const isOpen = expanded[cat] === true;
          return (
            <div key={cat} className="hub-palette-category">
              <button
                type="button"
                onClick={() => toggleCat(cat)}
                className="mb-1 flex w-full items-center justify-between rounded bg-[var(--color-surface)] px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted)] hover:text-[var(--color-text-soft)]"
              >
                {gameMenuCategoryLabels[cat as GameMenuPaletteCategory]}
                <ChevronDown
                  className={cn("h-3 w-3 shrink-0 transition-transform", !isOpen && "-rotate-90")}
                  strokeWidth={1.5}
                />
              </button>
              {isOpen && (
                <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))" }}>
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      title={`${item.label} — ${item.description}`}
                      onClick={() => addElement(item.id)}
                      className="group flex flex-col items-stretch gap-0.5 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-1 transition-colors hover:border-[var(--color-accent-muted)] hover:bg-[var(--color-surface-hover)]"
                    >
                      <div className="hub-palette-preview">
                        <GameMenuPaletteIcon item={item} />
                      </div>
                      <span className="w-full truncate text-center text-[8px] leading-tight text-[var(--color-muted)] group-hover:text-[var(--color-text-soft)]">
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="hub-scroll-hidden max-h-full space-y-2 overflow-y-auto">
      <div className="sticky top-0 z-10 space-y-1 bg-[var(--color-surface)] pb-1">
        <p className="text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
          Filtrar componentes
        </p>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted)]"
            strokeWidth={1.5}
          />
          <input
            type="search"
            value={paletteQuery}
            onChange={(e) => setPaletteQuery(e.target.value)}
            placeholder="Nombre, tipo, categoría…"
            className="w-full rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] py-1.5 pl-7 pr-2 text-[11px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent-muted)]"
          />
        </div>
        {paletteSearchActive && (
          <p className="text-[9px] text-[var(--color-muted)]">
            {filteredPalette.length} componente{filteredPalette.length === 1 ? "" : "s"} en la biblioteca
          </p>
        )}
      </div>

      {!compact && !paletteSearchActive && (
        <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-muted)]">
          Componentes
        </p>
      )}

      {paletteSearchActive ? (
        filteredPalette.length === 0 ? (
          <p className="px-1 py-2 text-[10px] text-[var(--color-muted)]">
            Ningún componente coincide con «{paletteQuery.trim()}».
          </p>
        ) : (
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))" }}
          >
            {filteredPalette.map((item) => (
              <PaletteItemButton key={item.id} item={item} onAdd={addElement} />
            ))}
          </div>
        )
      ) : (
        CATEGORY_ORDER.map((cat) => {
          const items = elementPalette.filter((p) => p.category === cat);
          if (items.length === 0) return null;
          const isOpen = expanded[cat] === true;

          return (
            <div key={cat} className="hub-palette-category">
              <button
                type="button"
                onClick={() => toggleCat(cat)}
                className="mb-1 flex w-full items-center justify-between rounded bg-[var(--color-surface)] px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted)] hover:text-[var(--color-text-soft)]"
              >
                <span className="min-w-0 truncate">{paletteCategoryLabels[cat]}</span>
                <ChevronDown
                  className={cn("h-3 w-3 shrink-0 transition-transform", !isOpen && "-rotate-90")}
                  strokeWidth={1.5}
                />
              </button>

              {isOpen && (
                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))" }}
                >
                  {items.map((item) => (
                    <PaletteItemButton key={item.id} item={item} onAdd={addElement} />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
