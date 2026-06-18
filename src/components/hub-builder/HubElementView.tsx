"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { FORGE_VERSIONS, LAUNCH_PANEL_PARTS, resolveForgeVersion } from "@craftlauncher/shared";
import type { HubElement, HubElementType } from "@/types/hub-builder";
import {
  DEFAULT_SURFACE_BG,
  resolveBackgroundColor,
  resolveTextColor,
} from "@/components/hub-builder/hub-builder-hooks";
import { bindAccountHubElement } from "@craftlauncher/shared";
import { CHAT_PANEL_PARTS, isChatOverlayHubElement, isChatPanelContainer } from "@craftlauncher/shared";
import { paletteIcons } from "@/components/hub-builder/palette-icons";
import { useHubBuilderStore } from "@/lib/hub-builder-store";
import {
  hubElementCssForceClasses,
  hubElementCssToStyle,
  hubSearchFieldClassName,
  hubUsesFillControlSkin,
  hubVisualPresetActive,
  hubVisualRootProps,
  resolveEffectiveHubCss,
  resolveSearchFieldStyle,
} from "@craftlauncher/shared";
import { HubRuntimePreview, usesHubVisualPreview } from "@/components/hub-builder/HubRuntimePreview";
import { useHubCssElements } from "@/components/hub-builder/HubCssRuntimeContext";

interface HubElementViewProps {
  element: HubElement;
  selected?: boolean;
  editing?: boolean;
  runtime?: boolean;
  fillParent?: boolean;
  editorChatPreview?: boolean;
  onRuntimeClick?: () => void;
  onRuntimeChange?: (value: string | number | boolean) => void;
}

const RUNTIME_CLICKABLE = new Set<HubElementType>([
  "play-button",
  "button",
  "nav-item",
  "script-button",
  "api-call",
  "toast-trigger",
  "icon-button",
  "link",
  "banner",
  "news-card",
  "modpack-slot",
  "counter",
  "timer",
  "version-selector",
  "profile-widget",
]);

function runtimeClickProps(runtime: boolean | undefined, onRuntimeClick?: () => void) {
  if (!runtime || !onRuntimeClick) return {};
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      onRuntimeClick();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        onRuntimeClick();
      }
    },
  };
}

const typeIcons = paletteIcons;

const HUB_CANVAS_LAYOUT_SHELL_TYPES = new Set<HubElement["type"]>([
  "surface-box",
  "container",
  "instance-avatar-grid",
  "instance-list",
  "instance-avatar",
  "spacer",
  "divider",
  "launch-panel",
]);

function cssToStyle(css: HubElement["css"]): React.CSSProperties {
  return hubElementCssToStyle(css) as React.CSSProperties;
}

function WithLogic({ children }: { children: React.ReactNode }) {
  return <div className="relative h-full w-full">{children}</div>;
}

function ElementLabel({
  children,
  color,
  className,
}: {
  children: React.ReactNode;
  color: string;
  className?: string;
}) {
  return (
    <span className={className} style={{ color }}>
      {children}
    </span>
  );
}

export function HubElementView({
  element,
  selected,
  editing,
  runtime,
  fillParent,
  editorChatPreview,
  onRuntimeClick,
  onRuntimeChange,
}: HubElementViewProps) {
  const screenElements = useHubBuilderStore((s) => s.getActiveScreen().elements);
  const launchPanelChildren = useMemo(() => {
    if (element.type !== "launch-panel") return [];
    return screenElements.filter((e) => e.parentId === element.id).sort((a, b) => a.y - b.y);
  }, [screenElements, element.id, element.type]);
  const chatPanelChildren = useMemo(() => {
    if (!isChatPanelContainer(element)) return [];
    return screenElements.filter((e) => e.parentId === element.id).sort((a, b) => a.y - b.y);
  }, [screenElements, element.id, element.type]);

  const allElements = useHubCssElements();
  const effectiveElement = useMemo(() => {
    const pool = allElements.length ? allElements : [element];
    const withCss = { ...element, css: resolveEffectiveHubCss(element, pool) };
    if (!runtime) return withCss;
    return bindAccountHubElement(withCss, {
      displayName: "Usuario demo",
      username: "usuario",
      tier: "free",
    });
  }, [allElements, element, runtime]);

  if (
    !element.visible &&
    !(
      editorChatPreview &&
      (isChatOverlayHubElement(element) || isChatPanelContainer(element))
    )
  ) {
    return null;
  }

  if (element.type.startsWith("chrome-")) {
    const chromeClickProps = runtimeClickProps(runtime && Boolean(onRuntimeClick), onRuntimeClick);
    return (
      <div
        {...chromeClickProps}
        className={cn(
          fillParent ? "absolute inset-0" : "absolute",
          "overflow-hidden",
          runtime && onRuntimeClick && "cursor-pointer"
        )}
        style={{
          ...(fillParent
            ? {
                width: "100%",
                height: "100%",
                position: "absolute",
                inset: 0,
                borderRadius: element.style.borderRadius ?? 6,
              }
            : {
                left: element.x,
                top: element.y,
                width: element.width,
                height: element.height,
                zIndex: element.zIndex,
                borderRadius: element.style.borderRadius ?? 6,
              }),
        }}
      >
        <div className={runtime ? "h-full w-full" : "pointer-events-none h-full w-full"}>
          <HubRuntimePreview element={effectiveElement} />
        </div>
      </div>
    );
  }

  const Icon = typeIcons[element.type];
  const radius = element.style.borderRadius ?? 10;
  const textColor = resolveTextColor(element.style.textColor);
  const bg = resolveBackgroundColor(element.style.backgroundColor, DEFAULT_SURFACE_BG);
  const fontSize = element.style.fontSize ?? 13;
  const fontWeight = element.style.fontWeight ?? "normal";
  const isClickable = runtime && RUNTIME_CLICKABLE.has(element.type);
  const clickProps = runtimeClickProps(isClickable, onRuntimeClick);
  const cssStyle = cssToStyle(element.css);
  const isLayoutShell = HUB_CANVAS_LAYOUT_SHELL_TYPES.has(element.type);

  const baseClass = cn(
    fillParent ? "absolute inset-0" : "absolute",
    "overflow-hidden",
    !editing && "transition-all",
    runtime ? "select-auto" : "select-none",
    runtime && isClickable && "cursor-pointer active:scale-[0.99]",
    editing && !runtime && "cursor-move",
    editing &&
      !runtime &&
      fillParent &&
      !selected &&
      element.type === "spacer" &&
      "border border-dashed border-[var(--color-border-subtle)]/20",
    !fillParent && !isLayoutShell && "border",
    !fillParent &&
      !isLayoutShell &&
      selected &&
      "border-[var(--color-accent)]/70 ring-1 ring-[var(--color-accent)]/20",
    !fillParent &&
      !isLayoutShell &&
      !selected &&
      "border-[var(--color-border-subtle)]/30",
    element.locked && editing && !runtime && "cursor-not-allowed opacity-80"
  );

  const boxStyle: React.CSSProperties = fillParent
    ? {
        width: "100%",
        height: "100%",
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        borderRadius: radius,
        color: textColor,
      }
    : {
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        zIndex: element.zIndex,
        borderRadius: radius,
        color: textColor,
      };

  if (isChatPanelContainer(element)) {
    const partLabels = new Map(CHAT_PANEL_PARTS.map((p) => [p.type, p.refBase]));

    if (chatPanelChildren.length > 0) {
      return (
        <div
          className={cn(baseClass, "overflow-hidden")}
          style={{
            ...boxStyle,
            background: bg || "#0f1116",
            border: "1px solid rgba(124, 131, 255, 0.45)",
            borderRadius: element.style.borderRadius ?? 14,
            ...cssStyle,
          }}
        >
          <div className="flex h-full flex-col gap-1.5 p-2">
            <p className="text-[9px] font-medium text-[#a5abff]">Panel chat · piezas</p>
            {chatPanelChildren.map((child) => {
              const ChildIcon = typeIcons[child.type];
              return (
                <div
                  key={child.id}
                  className="flex min-h-0 flex-1 items-center gap-2 rounded-md border border-dashed border-[#7c83ff55] bg-black/30 px-2"
                  style={{ minHeight: Math.max(14, child.height - 4) }}
                >
                  {ChildIcon && <ChildIcon className="h-3 w-3 shrink-0 text-[#a5abff]" strokeWidth={1.5} />}
                  <span className="truncate font-mono text-[9px] text-[var(--color-muted)]">
                    {child.label || child.logic?.refId || partLabels.get(child.type) || child.type}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  }

  if (element.type === "launch-panel") {
    const partLabels = new Map(LAUNCH_PANEL_PARTS.map((p) => [p.type, p.refBase]));

    if (launchPanelChildren.length > 0) {
      return (
        <div
          className={cn(baseClass, "overflow-hidden")}
          style={{
            ...boxStyle,
            background: bg,
            border: "1px solid rgba(107, 158, 120, 0.45)",
            borderRadius: element.style.borderRadius ?? 16,
            ...cssStyle,
          }}
        >
          <div className="flex h-full flex-col gap-1.5 p-2">
            <p className="text-[9px] font-medium text-[var(--color-accent)]">Panel lanzamiento · piezas</p>
            {launchPanelChildren.map((child) => {
              const Icon = typeIcons[child.type];
              return (
                <div
                  key={child.id}
                  className="flex min-h-0 flex-1 items-center gap-2 rounded-md border border-dashed border-[var(--color-border-subtle)] bg-black/20 px-2"
                  style={{ minHeight: Math.max(14, child.height - 4) }}
                >
                  {Icon && <Icon className="h-3 w-3 shrink-0 text-[var(--color-accent)]" strokeWidth={1.5} />}
                  <span className="truncate font-mono text-[9px] text-[var(--color-muted)]">
                    {child.logic?.refId ?? partLabels.get(child.type) ?? child.type}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    const Icon = typeIcons["launch-panel"];
    return (
      <div
        className={cn(baseClass, "flex flex-col justify-center")}
        style={{
          ...boxStyle,
          background: bg,
          border: "1px dashed rgba(107, 158, 120, 0.35)",
          ...cssStyle,
        }}
      >
        <div className="px-3">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-[var(--color-accent)]" strokeWidth={1.5} />}
            <ElementLabel color={textColor}>Panel descarga (vacío)</ElementLabel>
          </div>
          <p className="mt-1 text-[9px] text-[var(--color-muted)]">
            Arrastra otro «Panel descarga» o añade piezas de Lanzamiento dentro.
          </p>
        </div>
      </div>
    );
  }

  if (runtime && (element.type === "version-selector" || element.type === "dropdown")) {
      const options =
        element.type === "version-selector"
          ? FORGE_VERSIONS.map((v) => v.id)
          : String(element.logic?.constants?.OPTIONS ?? element.label)
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean);
      const current = resolveForgeVersion(
        String(element.value ?? options[0] ?? element.label)
      ).id;

      return (
        <select
          className={cn(baseClass, "cursor-pointer bg-[var(--color-surface-raised)] px-3 text-sm outline-none")}
          style={{ ...boxStyle, color: textColor, fontSize }}
          value={current}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onRuntimeChange?.(e.target.value)}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {element.type === "version-selector"
                ? (FORGE_VERSIONS.find((v) => v.id === opt)?.label ?? opt)
                : opt}
            </option>
          ))}
        </select>
      );
  }

  if (element.type === "toggle" && runtime) {
    const on = Boolean(element.value);
    return (
      <WithLogic>
        <button
          type="button"
          className={cn(baseClass, "flex items-center justify-center")}
          style={{ ...boxStyle, ...cssStyle }}
          onClick={(e) => {
            e.stopPropagation();
            onRuntimeChange?.(!on);
          }}
        >
          <div
            className={cn(
              "relative h-5 w-9 rounded-full transition-colors",
              on ? "bg-[var(--color-accent)]" : "bg-[var(--color-surface-hover)]"
            )}
          >
            <div
              className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                on ? "translate-x-4" : "translate-x-0.5"
              )}
            />
          </div>
        </button>
      </WithLogic>
    );
  }

  if (element.type === "input-field" && runtime) {
    const searchFieldWrapClass = [
      "hub-search-field-fill",
      hubSearchFieldClassName(resolveSearchFieldStyle(element)),
    ].join(" ");
    return (
      <WithLogic>
        <div className={cn(baseClass, searchFieldWrapClass)} style={{ ...boxStyle, background: "transparent" }}>
          <input
            type="text"
            className="lp-input hub-search-field-input px-2 text-xs outline-none"
            style={{ color: textColor, fontSize }}
            value={String(element.value ?? "")}
            placeholder={element.label || "Escribe aquí…"}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onRuntimeChange?.(e.target.value)}
          />
        </div>
      </WithLogic>
    );
  }

  if (element.type === "slider" && runtime) {
    const val = typeof element.value === "number" ? element.value : 50;
    return (
      <WithLogic>
        <div className={cn(baseClass, "flex items-center px-1")} style={{ ...boxStyle, ...cssStyle }}>
          <input
            type="range"
            min={0}
            max={100}
            value={val}
            className="h-1 w-full cursor-pointer accent-[var(--color-accent)]"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onRuntimeChange?.(Number(e.target.value))}
          />
        </div>
      </WithLogic>
    );
  }

  if (element.type === "checkbox" && runtime) {
    const checked = Boolean(element.value);
    return (
      <WithLogic>
        <button
          type="button"
          className={cn(baseClass, "flex items-center gap-2 px-1 text-left")}
          style={{ ...boxStyle, ...cssStyle }}
          onClick={(e) => {
            e.stopPropagation();
            onRuntimeChange?.(!checked);
          }}
        >
          <div
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
              checked
                ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                : "border-[var(--color-border)] bg-[var(--color-surface-raised)]"
            )}
          >
            {checked && <span className="text-[10px] text-[var(--color-accent)]">✓</span>}
          </div>
          <ElementLabel color={textColor} className="text-xs">
            {element.label}
          </ElementLabel>
        </button>
      </WithLogic>
    );
  }

  if (element.type === "automation-node") {
    return null;
  }

  if (element.type === "spacer") {
    return <div className={cn(baseClass, "border-transparent bg-transparent")} style={{ ...boxStyle, ...cssStyle }} aria-hidden />;
  }

  if (usesHubVisualPreview(element.type)) {
    const fillSkin = hubUsesFillControlSkin(element.type);
    const preset = hubVisualPresetActive(element);
    const shellSkin = hubVisualRootProps(element, {
      style: {
        ...boxStyle,
        background: fillSkin || !preset ? "transparent" : (boxStyle.background ?? "transparent"),
      },
    });
    return (
      <WithLogic>
        <div
          {...clickProps}
          className={cn(
            baseClass,
            "overflow-hidden",
            !fillSkin && shellSkin.className,
            hubElementCssForceClasses(effectiveElement)
          )}
          style={shellSkin.style as React.CSSProperties}
        >
          <HubRuntimePreview element={effectiveElement} />
        </div>
      </WithLogic>
    );
  }

  return (
    <div className={cn(baseClass, "flex items-center justify-center bg-[var(--color-surface-raised)]")} style={{ ...boxStyle, ...cssStyle }}>
      {Icon && <Icon className="h-4 w-4 text-[var(--color-muted)]" strokeWidth={1.5} />}
    </div>
  );
}
