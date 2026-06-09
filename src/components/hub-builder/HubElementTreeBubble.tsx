"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import {
  buildScreenElementForest,
  collectAncestorIds,
  elementTreeLabel,
  type ElementTreeNode,
  type HubElementSurface,
} from "@/lib/hub-builder-elements-index";
import { useHubBuilderStore } from "@/lib/hub-builder-store";
import { cn } from "@/lib/utils";

const INDENT = 11;

function TreeGuides({ guides, isLast }: { guides: boolean[]; isLast: boolean }) {
  return (
    <div className="hub-tree-guides" aria-hidden>
      {guides.map((continues, index) => (
        <span
          key={`g-${index}`}
          className={cn("hub-tree-indent", continues && "hub-tree-indent-continue")}
          style={{ width: INDENT }}
        />
      ))}
      <span
        className={cn("hub-tree-indent", isLast ? "hub-tree-indent-elbow-last" : "hub-tree-indent-elbow")}
        style={{ width: INDENT }}
      />
    </div>
  );
}

function TreeNodeRow({
  node,
  guides,
  isLast,
  surface,
  selectedId,
  expandedIds,
  onToggle,
  onSelect,
}: {
  node: ElementTreeNode;
  guides: boolean[];
  isLast: boolean;
  surface: HubElementSurface;
  selectedId: string | null;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (elementId: string, surface: HubElementSurface) => void;
}) {
  const el = node.element;
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(el.id);
  const isSelected = selectedId === el.id;
  const childGuides = [...guides, !isLast];
  const label = elementTreeLabel(el);

  return (
    <>
      <div className={cn("hub-tree-row", isSelected && "hub-tree-row-selected")}>
        <TreeGuides guides={guides} isLast={isLast} />
        {hasChildren ? (
          <button
            type="button"
            className="hub-tree-chevron"
            onClick={() => onToggle(el.id)}
            aria-label={isExpanded ? "Contraer" : "Expandir"}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" strokeWidth={2} />
            ) : (
              <ChevronRight className="h-3 w-3" strokeWidth={2} />
            )}
          </button>
        ) : (
          <span className="hub-tree-chevron-spacer" />
        )}
        <button
          type="button"
          className="hub-tree-label-btn"
          title={el.type}
          onClick={() => onSelect(el.id, surface)}
        >
          {label}
        </button>
      </div>
      {hasChildren &&
        isExpanded &&
        node.children.map((child, index) => (
          <TreeNodeRow
            key={child.element.id}
            node={child}
            guides={childGuides}
            isLast={index === node.children.length - 1}
            surface={surface}
            selectedId={selectedId}
            expandedIds={expandedIds}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}

function TreeSection({
  title,
  sectionId,
  roots,
  surface,
  isLastSection,
  selectedId,
  expandedSections,
  expandedNodes,
  onToggleSection,
  onToggleNode,
  onSelect,
}: {
  title: string;
  sectionId: string;
  roots: ElementTreeNode[];
  surface: HubElementSurface;
  isLastSection: boolean;
  selectedId: string | null;
  expandedSections: Set<string>;
  expandedNodes: Set<string>;
  onToggleSection: (id: string) => void;
  onToggleNode: (id: string) => void;
  onSelect: (elementId: string, surface: HubElementSurface) => void;
}) {
  if (roots.length === 0) return null;
  const isOpen = expandedSections.has(sectionId);

  return (
    <div className="hub-tree-section">
      <button
        type="button"
        className="hub-tree-section-head"
        onClick={() => onToggleSection(sectionId)}
      >
        {isOpen ? (
          <ChevronDown className="h-3 w-3 shrink-0" strokeWidth={2} />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" strokeWidth={2} />
        )}
        <span>{title}</span>
        <span className="hub-tree-section-count">{roots.length}</span>
      </button>
      {isOpen && (
        <div className="hub-tree-section-body">
          {roots.map((node, index) => (
            <TreeNodeRow
              key={node.element.id}
              node={node}
              guides={[!isLastSection]}
              isLast={index === roots.length - 1}
              surface={surface}
              selectedId={selectedId}
              expandedIds={expandedNodes}
              onToggle={onToggleNode}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function HubElementTreeBubble() {
  const bubble = useHubBuilderStore((s) => s.elementTreeBubble);
  const closeElementTreeBubble = useHubBuilderStore((s) => s.closeElementTreeBubble);
  const layout = useHubBuilderStore((s) => s.layout);
  const selectedId = useHubBuilderStore((s) => s.selectedId);
  const navigateToElement = useHubBuilderStore((s) => s.navigateToElement);
  const editTarget = useHubBuilderStore((s) => s.editTarget);

  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(["content"])
  );
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => new Set());

  const activeScreen =
    layout.screens.find((s) => s.id === layout.activeScreenId) ?? layout.screens[0];
  const tree = useMemo(
    () => (activeScreen ? buildScreenElementForest(activeScreen) : null),
    [activeScreen]
  );

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!bubble || !panelRef.current) return;
    const panel = panelRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = bubble.x;
    let top = bubble.y;
    if (left + panel.width > vw - 8) left = vw - panel.width - 8;
    if (top + panel.height > vh - 8) top = vh - panel.height - 8;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    setPos({ top, left });
  }, [bubble]);

  useEffect(() => {
    if (!bubble) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeElementTreeBubble();
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-hub-tree-trigger]")) return;
      closeElementTreeBubble();
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [bubble, closeElementTreeBubble]);

  useEffect(() => {
    if (!selectedId || !tree) return;

    const inChrome = tree.chromeRoots.some((n) => containsId(n, selectedId));
    const inContent = tree.contentRoots.some((n) => containsId(n, selectedId));

    setExpandedSections((prev) => {
      const next = new Set(prev);
      let changed = false;
      if (inChrome && !next.has("chrome")) {
        next.add("chrome");
        changed = true;
      }
      if (inContent && !next.has("content")) {
        next.add("content");
        changed = true;
      }
      return changed ? next : prev;
    });

    const flat = flattenTree(inChrome ? tree.chromeRoots : inContent ? tree.contentRoots : []);
    const ancestors = collectAncestorIds(
      flat.map((n) => n.element),
      selectedId
    );
    if (ancestors.length === 0) return;

    setExpandedNodes((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of ancestors) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedId, tree]);

  if (!mounted || !bubble || !tree || !activeScreen) return null;

  const handleSelect = (elementId: string, surface: HubElementSurface) => {
    navigateToElement({ elementId, screenId: activeScreen.id, surface });
    closeElementTreeBubble();
  };

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const editingChrome = editTarget === "launcher-chrome";
  const showChromeSection = !editingChrome && tree.chromeRoots.length > 0;
  const showContentSection =
    (editingChrome ? tree.chromeRoots : tree.contentRoots).length > 0;

  return createPortal(
    <div
      ref={panelRef}
      data-hub-element-tree-bubble
      className="hub-tree-bubble"
      style={{ top: pos.top, left: pos.left }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="hub-tree-header">
        <div className="min-w-0">
          <p className="hub-tree-header-kicker">Árbol</p>
          <p className="hub-tree-header-title">{tree.screenName}</p>
        </div>
        <button
          type="button"
          onClick={closeElementTreeBubble}
          className="hub-tree-close"
          aria-label="Cerrar árbol"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="hub-tree-panel">
        {showChromeSection && (
          <TreeSection
            title="Barra superior"
            sectionId="chrome"
            roots={tree.chromeRoots}
            surface="chrome"
            isLastSection={!showContentSection}
            selectedId={selectedId}
            expandedSections={expandedSections}
            expandedNodes={expandedNodes}
            onToggleSection={toggleSection}
            onToggleNode={toggleNode}
            onSelect={handleSelect}
          />
        )}
        {showContentSection && (
          <TreeSection
            title={editingChrome ? "Barra superior" : "Contenido"}
            sectionId="content"
            roots={editingChrome ? tree.chromeRoots : tree.contentRoots}
            surface={editingChrome ? "chrome" : "content"}
            isLastSection
            selectedId={selectedId}
            expandedSections={expandedSections}
            expandedNodes={expandedNodes}
            onToggleSection={toggleSection}
            onToggleNode={toggleNode}
            onSelect={handleSelect}
          />
        )}
        {!showChromeSection && !showContentSection && (
          <p className="hub-tree-empty">Sin elementos</p>
        )}
      </div>
    </div>,
    document.body
  );
}

function containsId(node: ElementTreeNode, id: string): boolean {
  if (node.element.id === id) return true;
  return node.children.some((child) => containsId(child, id));
}

function flattenTree(nodes: ElementTreeNode[]): ElementTreeNode[] {
  const out: ElementTreeNode[] = [];
  const walk = (list: ElementTreeNode[]) => {
    for (const node of list) {
      out.push(node);
      walk(node.children);
    }
  };
  walk(nodes);
  return out;
}
