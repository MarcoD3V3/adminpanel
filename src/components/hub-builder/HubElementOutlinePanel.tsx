"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Layers, Search } from "lucide-react";
import {
  buildScreenElementForest,
  elementTreeLabel,
  searchHubElements,
  surfaceLabel,
  type HubElementSearchHit,
} from "@/lib/hub-builder-elements-index";
import { useHubBuilderStore } from "@/lib/hub-builder-store";
import { cn } from "@/lib/utils";

/** Búsqueda global + disparador del árbol (clic derecho en el recuadro Árbol). */
export function HubElementOutlinePanel() {
  const layout = useHubBuilderStore((s) => s.layout);
  const navigateToElement = useHubBuilderStore((s) => s.navigateToElement);
  const openElementTreeBubble = useHubBuilderStore((s) => s.openElementTreeBubble);
  const closeElementTreeBubble = useHubBuilderStore((s) => s.closeElementTreeBubble);
  const elementTreeBubble = useHubBuilderStore((s) => s.elementTreeBubble);

  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const treeTriggerRef = useRef<HTMLDivElement>(null);

  const searchResults = useMemo(() => searchHubElements(layout, query), [layout, query]);

  const activeScreen =
    layout.screens.find((s) => s.id === layout.activeScreenId) ?? layout.screens[0];
  const activeTree = useMemo(
    () => (activeScreen ? buildScreenElementForest(activeScreen) : null),
    [activeScreen]
  );
  const elementCount = activeTree
    ? activeTree.contentRoots.length +
      activeTree.chromeRoots.length +
      countNested(activeTree.contentRoots) +
      countNested(activeTree.chromeRoots)
    : 0;

  const goToHit = (hit: HubElementSearchHit) => {
    navigateToElement({
      elementId: hit.element.id,
      screenId: hit.screenId,
      surface: hit.surface,
    });
    setQuery("");
    setHighlightIndex(0);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (searchResults.length === 0) return;
      setHighlightIndex((i) => (i + 1) % searchResults.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (searchResults.length === 0) return;
      setHighlightIndex((i) => (i - 1 + searchResults.length) % searchResults.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const hit = searchResults[highlightIndex] ?? searchResults[0];
      if (hit) goToHit(hit);
      return;
    }
    if (e.key === "Escape") {
      setQuery("");
      setHighlightIndex(0);
    }
  };

  const handleTreeContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = treeTriggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (elementTreeBubble) {
      closeElementTreeBubble();
      return;
    }

    openElementTreeBubble(rect.right + 8, rect.top);
  };

  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  return (
    <div className="shrink-0 space-y-2 border-b border-[var(--color-border-subtle)] pb-2">
      <div className="space-y-1">
        <p className="text-[9px] font-medium uppercase tracking-wide text-[var(--color-muted)]">Buscar</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Nombre, tipo, clase, Ref ID…"
            className="h-8 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] pl-7 pr-2 text-[10px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent-muted)]"
          />
        </div>
        {query.trim() && (
          <div className="max-h-36 overflow-y-auto rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)]">
            {searchResults.length === 0 ? (
              <p className="px-2 py-2 text-[10px] text-[var(--color-muted)]">Sin resultados</p>
            ) : (
              searchResults.slice(0, 12).map((hit, index) => (
                <button
                  key={`${hit.screenId}:${hit.surface}:${hit.element.id}`}
                  type="button"
                  onMouseEnter={() => setHighlightIndex(index)}
                  onClick={() => goToHit(hit)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 border-b border-[var(--color-border-subtle)]/50 px-2 py-1.5 text-left last:border-b-0",
                    index === highlightIndex
                      ? "bg-[var(--color-accent-soft)]"
                      : "hover:bg-[var(--color-surface-hover)]"
                  )}
                >
                  <span className="truncate text-[10px] font-medium text-[var(--color-text-soft)]">
                    {elementTreeLabel(hit.element)}
                  </span>
                  <span className="truncate font-mono text-[9px] text-[var(--color-muted)]">
                    {hit.screenName} · {surfaceLabel(hit.surface)} · {hit.element.type}
                    {hit.element.logic?.refId ? ` · ref:${hit.element.logic.refId}` : ""}
                    {hit.element.positionClass ? ` · .${hit.element.positionClass}` : ""}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
        <p className="text-[9px] text-[var(--color-muted)]">Enter para ir y seleccionar</p>
      </div>

      <div
        ref={treeTriggerRef}
        data-hub-tree-trigger
        role="button"
        tabIndex={0}
        onContextMenu={handleTreeContextMenu}
        className={cn(
          "cursor-context-menu rounded-lg border px-2.5 py-2 transition-colors",
          elementTreeBubble
            ? "border-[var(--color-accent-muted)] bg-[var(--color-accent-soft)]/40"
            : "border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)]/40 hover:border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
        )}
        title="Clic derecho para abrir el árbol de la ventana activa"
      >
        <div className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
          <Layers className="h-3 w-3 shrink-0" strokeWidth={1.5} />
          Árbol
        </div>
        <p className="mt-1 truncate text-[10px] font-medium text-[var(--color-text-soft)]">
          {activeTree?.screenName ?? "Sin ventana"}
        </p>
        <p className="mt-0.5 text-[9px] leading-snug text-[var(--color-muted)]">
          {elementCount > 0
            ? `${elementCount} elemento${elementCount === 1 ? "" : "s"} · clic derecho aquí`
            : "Vacío · clic derecho para abrir"}
        </p>
      </div>
    </div>
  );
}

function countNested(roots: { children: unknown[] }[]): number {
  let n = 0;
  const walk = (nodes: { children: unknown[] }[]) => {
    for (const node of nodes) {
      n += node.children.length;
      walk(node.children as { children: unknown[] }[]);
    }
  };
  walk(roots);
  return n;
}
