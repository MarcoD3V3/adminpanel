"use client";

import type { CSSProperties, ReactNode } from "react";
import type { HubElement, HubElementType } from "@/types/hub-builder";
import type { LauncherInstance } from "@craftlauncher/shared";
import {
  DEFAULT_HUB_PLAY_BG,
  DEFAULT_HUB_SURFACE_BG,
  FORGE_VERSIONS,
  hubElementCssToStyle,
  hubElementUiCssVars,
  hubGridStyle,
  HUB_STRETCH_CONTENT_ELEMENT_TYPES,
  hubContentLayoutColumnStyle,
  hubContentLayoutStyle,
  instanceAvatarInitial,
  resolveInstanceIconColor,
  instanceAvatarClusterStyle,
  instanceAvatarGroupsWrapStyle,
  instanceAvatarShellStyle,
  resolveInstanceAvatarBuckets,
  resolveInstanceAvatarRenderSize,
  resolveInstanceAvatarUi,
  SEARCH_FIELD_ELEMENT_TYPES,
  hubVisualRootProps,
  hubVisualPresetActive,
  hubFillControlBtnProps,
  hubTextStyleClassForElement,
  hubTextStyleInlineCss,
  hubUsesFillControlSkin,
  hubElementSurfaceWrapperClass,
  hubPillSelectClassName,
  hubSearchFieldClassName,
  resolveHubBackgroundColor,
  resolveHubElementUi,
  resolveHubTextColor,
  resolvePillSelectStyle,
  resolveSearchFieldStyle,
  resolveSurfaceBoxShellStyle,
} from "@craftlauncher/shared";
import { HubElementIcon } from "@/components/hub-builder/hub-element-icon-registry";
import { paletteIcons } from "@/components/hub-builder/palette-icons";
import {
  isPreviewNavTargetActive,
  resolveHubBuilderPreviewLabel,
  resolveModsTabActiveLabel,
  useHubBuilderPreviewContext,
} from "@/components/hub-builder/hub-builder-preview-context";
import { GAME_MENU_SCREEN_ID } from "@/lib/game-ui-export";
import {
  gameMenuPreviewCssVars,
  isGameMenuTransparentBg,
} from "@/lib/game-menu-styles";
import { cn } from "@/lib/utils";
import { Check, ExternalLink, Package, RefreshCw, Search } from "lucide-react";

const MOD_TABS = ["Mods", "Modpacks", "Texturas", "Destacados"] as const;

const MOCK_PROFILES = [
  { value: "p1", label: "danilo · 1.16.5" },
  { value: "p2", label: "Principal · 1.20.1" },
  { value: "p3", label: "ashe · 1.18.2" },
];

const MOCK_INSTANCES = [
  { id: "legendary", name: "Legendary", iconColor: "#c9a227" },
  { id: "better-mc", name: "Better MC", iconColor: "#3d5a45" },
  { id: "create", name: "Create", iconColor: "#e67e22" },
  { id: "vanilla", name: "Vanilla", iconColor: "#496f4f" },
  { id: "fox", name: "Fox Pack", iconColor: "#d4a574" },
];

const MOCK_MODS = [
  {
    name: "All the Mods 6 - To the Sky",
    author: "ATMTeam",
    summary: "Big modpack warning: Requires at least 6-8gb of ram…",
    downloads: 1_109_446,
  },
  {
    name: "All the Mods 6 - To the Sky",
    author: "ATMTeam",
    summary: "Big modpack warning: Requires at least 6-8gb of ram…",
    downloads: 1_109_446,
  },
  {
    name: "All the Mods 6 - To the Sky",
    author: "ATMTeam",
    summary: "Big modpack warning: Requires at least 6-8gb of ram…",
    downloads: 1_109_446,
  },
  {
    name: "All the Mods 6 - To the Sky",
    author: "ATMTeam",
    summary: "Big modpack warning: Requires at least 6-8gb of ram…",
    downloads: 1_109_446,
  },
  {
    name: "Create",
    author: "simibubi",
    summary: "Technology mod centered around the power of rotation.",
    downloads: 42_500_000,
  },
  {
    name: "JEI",
    author: "mezz",
    summary: "View all recipes and uses for items in-game.",
    downloads: 180_000_000,
  },
];

const MOCK_INSTALLED_MODS = [
  {
    displayName: "Architectury API",
    fileName: "architectury-13.0.8-neoforge.jar",
    size: 49_200,
    hasUpdate: false,
    disabled: false,
    selected: true,
  },
  {
    displayName: "[1.21 Neoforge] Alternate Quests",
    fileName: "alternate-quests-1.2.jar",
    size: 49_200,
    hasUpdate: true,
    disabled: false,
    selected: false,
  },
  {
    displayName: "CraterLib",
    fileName: "CraterLib-3.1.2.jar",
    size: 128_400,
    hasUpdate: false,
    disabled: true,
    selected: false,
  },
  {
    displayName: "Curios API",
    fileName: "curios-neoforge-9.0.0.jar",
    size: 312_800,
    hasUpdate: false,
    disabled: false,
    selected: false,
  },
];

function formatPreviewBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const SKIP_VISUAL_PREVIEW = new Set<HubElementType>(["spacer", "automation-node", "launch-panel"]);

const STRETCH_FILL_PREVIEW_TYPES = new Set<HubElementType>([
  "play-button",
  "play-show-bind",
  "button",
  "nav-item",
  "script-button",
  "api-call",
  "instance-selector",
  "installed-version-selector",
  "version-selector",
  "instance-version-select",
  "dropdown",
  "panel-visibility-select",
  "surface-box",
]);

function previewCssToStyle(css: HubElement["css"]): CSSProperties {
  return hubElementCssToStyle(css) as CSSProperties;
}

function previewSurfaceInnerStyle(element: HubElement): CSSProperties {
  const containerDisplay = element.container?.display ?? "flex";
  const isFlow = containerDisplay !== "absolute";
  const pad = isFlow ? Math.max(0, Number(element.container?.padding ?? 0)) : 0;
  if (!isFlow) {
    return { width: "100%", height: "100%", boxSizing: "border-box" };
  }
  return {
    display: containerDisplay,
    flexDirection: element.container?.direction ?? "column",
    flexWrap: element.container?.wrap ? "wrap" : "nowrap",
    alignItems: element.container?.align ?? "stretch",
    justifyContent: element.container?.justify ?? "flex-start",
    gap: element.container?.gap ?? 0,
    padding: pad,
    boxSizing: "border-box",
    width: "100%",
    height: "100%",
    minWidth: 0,
    minHeight: 0,
    ...hubContentLayoutStyle(element.style, element.type),
  };
}

export function usesHubVisualPreview(type: HubElementType): boolean {
  return !SKIP_VISUAL_PREVIEW.has(type);
}

type HubRuntimePreviewProps = {
  element: HubElement;
  style?: CSSProperties;
  compact?: boolean;
};

/** Solo decorativo: nunca usar <button> (la paleta envuelve el preview en un botón). */
function PreviewBtn({
  className,
  style,
  children,
  elementId,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  elementId?: string;
}) {
  return (
    <div
      className={className}
      style={style}
      aria-hidden="true"
      {...(elementId ? { "data-hub-el": elementId } : {})}
    >
      {children}
    </div>
  );
}

function PreviewInstanceAvatar({
  name,
  iconColor,
  selected,
  size,
}: {
  name: string;
  iconColor: string;
  selected?: boolean;
  size: number;
}) {
  const initial = instanceAvatarInitial(name);
  return (
    <div
      className={joinPreviewClasses(
        "ih-instance-avatar",
        "ih-instance-avatar--letter",
        selected && "selected"
      )}
      style={{
        background: iconColor,
        width: size,
        height: size,
        borderRadius: "50%",
        ["--ih-avatar-size" as string]: `${size}px`,
      }}
      title={name}
    >
      <span className="ih-instance-avatar-letter">{initial}</span>
    </div>
  );
}

function joinPreviewClasses(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

function PreviewInstanceAvatarList({ element }: { element: HubElement }) {
  const { ui, layout } = resolveInstanceAvatarUi(element);
  const mockInstances = MOCK_INSTANCES.map((m) => ({
    ...m,
    mcVersion: "1.20.1",
    loader: "forge" as const,
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01",
  }));
  const buckets = resolveInstanceAvatarBuckets(mockInstances, element);
  const clusterStyle = instanceAvatarClusterStyle(layout, ui, element);
  const avatarSize = resolveInstanceAvatarRenderSize(element, layout);
  const multiGroup = buckets.length > 1;

  const renderCluster = (group: LauncherInstance[], keyPrefix: string) => (
    <div key={keyPrefix} className="ih-instance-avatar-grid-inner" style={clusterStyle as CSSProperties}>
      {group.map((inst, i) => (
        <div key={inst.id} className="ih-instance-avatar-grid-cell">
          <PreviewInstanceAvatar
            name={inst.name}
            iconColor={resolveInstanceIconColor({ id: inst.id, name: inst.name, iconColor: inst.iconColor })}
            selected={i === 0 && keyPrefix === "g0"}
            size={avatarSize}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="ih-instance-avatar-grid" style={instanceAvatarShellStyle(element) as CSSProperties}>
      {multiGroup ? (
        <div className="ih-instance-avatar-groups" style={instanceAvatarGroupsWrapStyle(layout) as CSSProperties}>
          {buckets.map((group, i) => (
            <div key={`pg-${i}`} className="ih-instance-avatar-group">
              {renderCluster(group, `g${i}`)}
            </div>
          ))}
        </div>
      ) : (
        renderCluster(buckets[0] ?? [], "g0")
      )}
    </div>
  );
}

function PreviewShell({
  element,
  children,
  scroll,
  compact,
  frameStyle,
}: HubRuntimePreviewProps & { children: ReactNode; scroll?: boolean; frameStyle?: CSSProperties }) {
  const previewCtx = useHubBuilderPreviewContext();
  const isGameMenu = previewCtx.contextScreen.id === GAME_MENU_SCREEN_ID;
  const ui = resolveHubElementUi(element);
  const scrollClass = ui.hideScrollbar ? "hub-scroll-hidden" : "";
  const launcherStretch = HUB_STRETCH_CONTENT_ELEMENT_TYPES.has(element.type);
  const stretchFill = STRETCH_FILL_PREVIEW_TYPES.has(element.type);
  const scrollWrapClass = [
    scroll ? "hub-preview-scroll" : "hub-content-scaled",
    launcherStretch ? "hub-preview-launcher" : "",
    stretchFill ? "hub-content-stretch-fill" : "",
    scrollClass,
    "hub-runtime-content",
    hubTextStyleClassForElement(element),
  ]
    .filter(Boolean)
    .join(" ");
  const searchFieldWrapClass = SEARCH_FIELD_ELEMENT_TYPES.has(element.type)
    ? ["hub-search-field-fill", hubSearchFieldClassName(resolveSearchFieldStyle(element))].join(" ")
    : null;
  const surfaceWrapClass = hubElementSurfaceWrapperClass(element);

  const wrapChildren = (content: ReactNode) => {
    if (searchFieldWrapClass) {
      return <div className={searchFieldWrapClass}>{content}</div>;
    }
    if (surfaceWrapClass) {
      return (
        <div className={surfaceWrapClass} data-hub-surface="true">
          {content}
        </div>
      );
    }
    return content;
  };

  const frameRoot = hubUsesFillControlSkin(element.type)
    ? {
        className: "hub-preview-frame",
        style: {
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          ...(frameStyle as Record<string, string | number>),
        },
      }
    : hubVisualRootProps(element, {
        className: "hub-preview-frame",
        style: {
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          ...(frameStyle as Record<string, string | number>),
        },
      });

  return (
    <div className={frameRoot.className} style={frameRoot.style as CSSProperties}>
      <div
        className={[compact ? "hub-preview-root hub-preview-root--compact" : "hub-preview-root", scrollClass]
          .filter(Boolean)
          .join(" ")}
        style={{
          ...(hubVisualPresetActive(element)
            ? { borderRadius: "inherit" }
            : { borderRadius: isGameMenu ? 0 : (element.style.borderRadius ?? 10) }),
          width: "100%",
          height: "100%",
        }}
      >
        <div
          className={scrollWrapClass}
          style={{
            boxSizing: "border-box",
            zoom: compact ? 0.72 : ui.contentScale !== 1 ? ui.contentScale : undefined,
            fontSize: element.style.fontSize ?? 13,
            color: element.style.textColor,
            ...(stretchFill
              ? {
                  width: "100%",
                  height: "100%",
                  minWidth: 0,
                  minHeight: 0,
                }
              : { width: "100%", height: "100%", ...hubContentLayoutStyle(element.style, element.type) }),
            ...(hubElementUiCssVars(element) as CSSProperties),
            ...(hubTextStyleInlineCss(element) as CSSProperties),
          }}
        >
          {wrapChildren(children)}
        </div>
      </div>
    </div>
  );
}

function previewSurfaceBg(element: HubElement): string {
  return resolveHubBackgroundColor(element.style.backgroundColor, DEFAULT_HUB_SURFACE_BG);
}

function previewPlayBg(element: HubElement): string {
  const raw = element.style.backgroundColor?.trim();
  if (!raw || raw === DEFAULT_HUB_SURFACE_BG) {
    return DEFAULT_HUB_PLAY_BG;
  }
  return resolveHubBackgroundColor(raw, DEFAULT_HUB_PLAY_BG);
}

function PreviewPillSelect({ element }: { element: HubElement }) {
  const styleClass = hubPillSelectClassName(resolvePillSelectStyle(element));
  const label = element.label || "Opción";

  let options: { value: string; label: string }[] = [];
  if (element.type === "instance-selector") {
    const custom = element.label?.trim();
    options =
      custom && custom !== "Perfil"
        ? [{ value: "preview", label: custom }]
        : MOCK_PROFILES;
  } else if (
    element.type === "installed-version-selector" ||
    element.type === "version-selector" ||
    element.type === "instance-version-select"
  ) {
    options = FORGE_VERSIONS.slice(0, 4).map((v) => ({ value: v.id, label: v.label }));
  } else if (element.type === "dropdown") {
    options = String(element.logic?.constants?.OPTIONS ?? label)
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean)
      .map((o) => ({ value: o, label: o }));
    if (options.length === 0) options = [{ value: "opt", label: label }];
  } else {
    options = [{ value: "panel", label: label || "Panel ▾" }];
  }

  const current = options[0]?.value ?? "";

  return (
    <select
      className={cn(styleClass, "hub-preview-pill-fill")}
      disabled
      defaultValue={current}
      aria-hidden="true"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function HubRuntimePreview({ element, style, compact }: HubRuntimePreviewProps) {
  const previewCtx = useHubBuilderPreviewContext();
  const isGameMenu = previewCtx.contextScreen.id === GAME_MENU_SCREEN_ID;
  const Icon = paletteIcons[element.type];
  const label = resolveHubBuilderPreviewLabel(element, previewCtx);
  const surfaceBg = previewSurfaceBg(element);
  const playBg = previewPlayBg(element);
  const textColor = resolveHubTextColor(element.style.textColor);

  if (element.type.startsWith("chrome-")) {
    const chromeLabel = label;
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <div className="hub-preview-chrome">
            {element.type === "chrome-icon-button" ? (
              <span className="hub-preview-chrome-icon">
                <HubElementIcon element={element} size={14} strokeWidth={2} />
              </span>
            ) : element.type === "chrome-divider" ? (
              <div className="hub-preview-divider" />
            ) : element.type === "chrome-launch-progress" ? (
              <div className="hub-preview-progress">
                <span />
              </div>
            ) : (
              <span>{chromeLabel}</span>
            )}
          </div>
        </PreviewShell>
    );
  }

  if (element.type === "play-button" || element.type === "play-show-bind") {
    const ghost = isGameMenu && isGameMenuTransparentBg(element.style);
    const btn = hubFillControlBtnProps(
      element,
      cn(
        "hub-preview-btn hub-preview-btn--play hub-preview-btn--fill",
        ghost && "hub-preview-btn--ghost"
      ),
      isGameMenu
        ? (gameMenuPreviewCssVars(element) as Record<string, string | number | undefined>)
        : {
            background: playBg,
            color: textColor,
            fontWeight: element.style.fontWeight ?? "medium",
            fontSize: element.style.fontSize,
            borderRadius: element.style.borderRadius ?? 8,
          }
    );
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <PreviewBtn className={btn.className} style={btn.style} elementId={element.id}>
            {label || "Jugar"}
          </PreviewBtn>
        </PreviewShell>
    );
  }

  if (element.type === "button" || element.type === "nav-item" || element.type === "script-button" || element.type === "api-call") {
    const navActive = isPreviewNavTargetActive(element, previewCtx.contextScreen);
    const ghost = isGameMenu && isGameMenuTransparentBg(element.style);
    const btn = hubFillControlBtnProps(
      element,
      cn(
        "hub-preview-btn secondary hub-preview-btn--fill",
        navActive && "lp-tab active",
        ghost && "hub-preview-btn--ghost"
      ),
      isGameMenu
        ? (gameMenuPreviewCssVars(element) as Record<string, string | number | undefined>)
        : {
            background: navActive ? undefined : surfaceBg,
            color: textColor,
            fontWeight: element.style.fontWeight,
            fontSize: element.style.fontSize,
            borderRadius: element.style.borderRadius ?? 8,
          }
    );
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <PreviewBtn className={btn.className} style={btn.style} elementId={element.id}>
            {label}
          </PreviewBtn>
        </PreviewShell>
    );
  }

  if (element.type === "icon-button" || element.type === "toast-trigger") {
    const iconSize = Math.max(12, Math.min(22, Math.round(Math.min(element.width, element.height) * 0.45)));
    const btn = hubFillControlBtnProps(element, "hub-preview-icon-btn hub-preview-btn--fill", {
      background: surfaceBg,
      color: textColor,
      borderRadius: element.style.borderRadius ?? 10,
    });
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <PreviewBtn className={btn.className} style={btn.style} elementId={element.id}>
            <HubElementIcon element={element} size={iconSize} strokeWidth={2} />
          </PreviewBtn>
        </PreviewShell>
    );
  }

  if (element.type === "link") {
    if (isGameMenu) {
      const ghost = isGameMenuTransparentBg(element.style);
      const btn = hubFillControlBtnProps(
        element,
        cn("hub-preview-btn secondary hub-preview-btn--fill", ghost && "hub-preview-btn--ghost"),
        gameMenuPreviewCssVars(element) as Record<string, string | number | undefined>
      );
      return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <PreviewBtn className={btn.className} style={btn.style} elementId={element.id}>
            {label || "Enlace"}
          </PreviewBtn>
        </PreviewShell>
      );
    }
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <span className="hub-preview-link">{label || "Enlace"}</span>
        </PreviewShell>
    );
  }

  if (element.type === "text") {
    const isLogo = element.style.gameMenuBinding === "minecraft_logo";
    const gmScale = isGameMenu ? previewCtx.gameMenuUiScale || 1 : 1;
    const baseFont = element.style.fontSize ?? (isLogo ? 22 : 12);
    return (
      <PreviewShell element={element} compact={compact} frameStyle={style}>
        <span
          className={cn("hub-preview-text", isLogo && "block w-full text-center font-bold tracking-[0.12em]")}
          style={{
            color: textColor,
            fontSize: baseFont * gmScale,
            fontWeight: element.style.fontWeight ?? (isLogo ? "bold" : undefined),
            fontFamily: isLogo
              ? '"VT323","Pixelify Sans",ui-monospace,monospace'
              : '"VT323","Pixelify Sans",ui-monospace,monospace',
            textShadow: isLogo
              ? "2px 0 0 #3f3f3f, -2px 0 0 #3f3f3f, 0 2px 0 #3f3f3f, 0 -2px 0 #3f3f3f"
              : "1px 1px 0 rgba(0,0,0,0.85)",
            lineHeight: 1.2,
          }}
        >
          {label}
        </span>
      </PreviewShell>
    );
  }

  if (element.type === "image") {
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          {element.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={element.imageUrl} alt="" className="hub-preview-image" />
          ) : (
            <div className="hub-preview-image-placeholder">{label}</div>
          )}
        </PreviewShell>
    );
  }

  if (element.type === "banner") {
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <div
            className="hub-preview-banner"
            style={{
              background: element.imageUrl ? `url(${element.imageUrl}) center/cover` : surfaceBg,
            }}
          >
            <span>{label}</span>
          </div>
        </PreviewShell>
    );
  }

  if (element.type === "news-card") {
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <div className="hub-preview-pane">
            <h4>{label}</h4>
            <div className="hub-preview-news-line">Update 1.2.1 disponible</div>
            <div className="hub-preview-news-line">Evento doble XP</div>
          </div>
        </PreviewShell>
    );
  }

  if (element.type === "modpack-slot") {
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <div className="hub-preview-modpack">
            <div className="hub-preview-modpack-cover" />
            <span>{label}</span>
          </div>
        </PreviewShell>
    );
  }

  if (element.type === "profile-widget") {
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <div className="hub-preview-profile">
            <div className="hub-preview-profile-avatar">{label.slice(0, 2).toUpperCase()}</div>
            <div>
              <div className="hub-preview-card-name">{label}</div>
              <div className="hub-preview-card-meta">● Jugando</div>
            </div>
          </div>
        </PreviewShell>
    );
  }

  if (element.type === "stat-card") {
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <div className="hub-preview-stat">
            <strong>{label}</strong>
            <span>métrica</span>
          </div>
        </PreviewShell>
    );
  }

  if (element.type === "chip" || element.type === "minecraft-status-chip" || element.type === "action-chip") {
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <span className="hub-preview-chip">{label}</span>
        </PreviewShell>
    );
  }

  if (element.type === "progress-bar" || element.type === "launch-progress-bar") {
    const pct = typeof element.value === "number" ? element.value : 45;
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <div className="hub-preview-progress">
            <span style={{ width: `${pct}%` }} />
          </div>
        </PreviewShell>
    );
  }

  if (element.type === "surface-box") {
    const shellStyle = resolveSurfaceBoxShellStyle(element, { fallbackBg: surfaceBg });
    return (
        <PreviewShell
          element={element}
          compact={compact}
          frameStyle={{
            ...style,
            ...shellStyle,
          }}
        >
          <div className="hub-preview-surface-box" style={previewSurfaceInnerStyle(element)} />
        </PreviewShell>
    );
  }

  if (element.type === "container") {
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <div className="hub-preview-container">
            <span>{label || "Contenedor"}</span>
          </div>
        </PreviewShell>
    );
  }

  if (element.type === "divider") {
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <div className="hub-preview-divider" />
        </PreviewShell>
    );
  }

  if (element.type === "input-field" || element.type === "instance-name-input") {
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <div className="hub-preview-field">
            <div className="hub-preview-input-fake lp-input ih-input">{label || "Escribe aquí…"}</div>
          </div>
        </PreviewShell>
    );
  }

  if (
    element.type === "dropdown" ||
    element.type === "version-selector" ||
    element.type === "instance-selector" ||
    element.type === "installed-version-selector" ||
    element.type === "instance-version-select" ||
    element.type === "panel-visibility-select"
  ) {
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          {element.type === "panel-visibility-select" ? (
            <div className="panel-vis-select">
              {label ? <span className="panel-vis-select-label">{label}</span> : null}
              <PreviewPillSelect element={element} />
            </div>
          ) : (
            <PreviewPillSelect element={element} />
          )}
        </PreviewShell>
    );
  }

  if (element.type === "checkbox") {
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <div className="hub-preview-check">
            <span className="hub-preview-check-box">✓</span>
            {label}
          </div>
        </PreviewShell>
    );
  }

  if (element.type === "toggle" || element.type === "toggle-visible" || element.type === "launch-desktop-window-toggle") {
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <div className="hub-preview-toggle">
            <span />
          </div>
        </PreviewShell>
    );
  }

  if (element.type === "slider") {
    const pct = typeof element.value === "number" ? element.value : 50;
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <div className="hub-preview-slider">
            <span style={{ left: `${pct}%` }} />
          </div>
        </PreviewShell>
    );
  }

  if (element.type === "timer" || element.type === "counter") {
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <div className="hub-preview-stat">
            <strong>{label}</strong>
          </div>
        </PreviewShell>
    );
  }

  if (element.type === "mods-tabs") {
    const activeTab = resolveModsTabActiveLabel(previewCtx.contextScreen);
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <div className="lp-tabs">
            {MOD_TABS.map((t) => (
              <span key={t} className={cn("lp-tab", activeTab === t && "active")}>
                {t}
              </span>
            ))}
          </div>
        </PreviewShell>
    );
  }

  if (element.type === "chat-bubble-toggle") {
    return (
      <PreviewShell element={element} compact={compact} frameStyle={style}>
        <div className="hub-preview-btn hub-chat-toggle-preview">💬</div>
      </PreviewShell>
    );
  }

  if (element.type === "launcher-update-banner") {
    return (
      <PreviewShell element={element} compact={compact} frameStyle={style}>
        <div className="launcher-update-banner" style={{ position: "relative", height: "100%" }}>
          <div className="launcher-update-banner-body">
            <p className="launcher-update-banner-title">{element.label || "Nueva actualización"}</p>
            <p className="launcher-update-banner-msg">v1.3.0 · ejemplo (solo si hay update real)</p>
          </div>
        </div>
      </PreviewShell>
    );
  }

  if (
    element.type === "chat-header" ||
    element.type === "chat-panel" ||
    element.type === "chat-tabs" ||
    element.type === "chat-input" ||
    element.type === "chat-send" ||
    element.type === "chat-close" ||
    element.type === "chat-resize-handle"
  ) {
    const partLabel = label || element.type.replace("chat-", "");
    const panelLike = element.type === "chat-panel";
    return (
      <PreviewShell element={element} compact={compact} frameStyle={style}>
        <div
          className={cn("hub-preview-chat-part", panelLike && "hub-preview-chat-part--panel")}
        >
          {partLabel}
        </div>
      </PreviewShell>
    );
  }

  if (element.type === "mods-search") {
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <div className="lp-search hub-preview-search">
            <div className="lp-search-field">
              <Search size={14} className="lp-search-icon" aria-hidden />
              <div className="hub-preview-input-fake lp-input lp-search-input">{label || "Buscar mods…"}</div>
            </div>
          </div>
        </PreviewShell>
    );
  }

  if (element.type === "mods-results" || element.type === "mods-catalog") {
    const ui = resolveHubElementUi(element);
    const gridStyle = hubGridStyle(ui);
    const count = ui.gridColumns > 0 ? Math.min(ui.gridColumns * 3, MOCK_MODS.length) : 6;
    return (
        <PreviewShell element={element} scroll compact={compact} frameStyle={style}>
          <div className="mc-catalog hub-preview-catalog">
            <div className="mc-grid" style={gridStyle as CSSProperties}>
              {MOCK_MODS.slice(0, count).map((m, i) => (
                <div key={`${m.name}-${i}`} className={`mc-card${i === 0 ? " selected" : ""}`}>
                  <div className="mc-card-img mc-card-img-fallback">
                    <Package size={20} aria-hidden />
                  </div>
                  <div className="mc-card-body">
                    <strong className="mc-card-name">{m.name}</strong>
                    <p className="mc-card-summary">{m.summary}</p>
                    <small className="mc-card-meta">
                      {m.downloads.toLocaleString()} ↓ · {m.author}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PreviewShell>
    );
  }

  if (element.type === "mods-preview") {
    return (
        <PreviewShell element={element} scroll compact={compact} frameStyle={style}>
          <aside className="mc-preview">
            <div className="mc-preview-body">
              <div className="mc-preview-hero">
                <div className="mc-preview-logo mc-preview-logo-fallback">
                  <Package size={28} aria-hidden />
                </div>
                <div className="mc-preview-hero-text">
                  <h3 className="mc-preview-title">Architectury API</h3>
                  <p className="mc-preview-authors">maxhegg</p>
                </div>
              </div>

              <div className="mc-preview-status-row">
                <span className="mc-preview-status mc-preview-status--ok">
                  <Check size={11} aria-hidden />
                  Instalado · architectury-13.0.8-neoforge.jar
                </span>
              </div>

              <div className="mc-preview-tags">
                <span className="mc-tag">API and Library</span>
              </div>

              <p className="mc-preview-desc">
                A intermediary api aimed to ease developing multiplatform mods.
              </p>

              <dl className="mc-preview-meta">
                <div className="mc-preview-meta__row">
                  <dt>Proyecto</dt>
                  <dd>architectury-api</dd>
                </div>
                <div className="mc-preview-meta__row">
                  <dt>Versión</dt>
                  <dd>13.0.8+1.21.1-neoforge</dd>
                </div>
                <div className="mc-preview-meta__row">
                  <dt>Minecraft</dt>
                  <dd>1.21.1</dd>
                </div>
                <div className="mc-preview-meta__row">
                  <dt>Archivo</dt>
                  <dd>architectury-13.0.8-neoforge.jar (49.2 KB)</dd>
                </div>
                <div className="mc-preview-meta__row">
                  <dt>Actualizado</dt>
                  <dd>12 sept 2024</dd>
                </div>
                <div className="mc-preview-meta__row">
                  <dt>Descargas</dt>
                  <dd>23,000,000</dd>
                </div>
                <div className="mc-preview-meta__row">
                  <dt>ID</dt>
                  <dd>419699</dd>
                </div>
              </dl>
            </div>

            <div className="mc-preview-actions">
              <PreviewBtn className="lp-btn lp-btn-installed">
                <Check size={14} aria-hidden /> Modpack instalado
              </PreviewBtn>
              <PreviewBtn className="lp-btn-secondary">
                <ExternalLink size={14} aria-hidden /> CurseForge
              </PreviewBtn>
            </div>
          </aside>
        </PreviewShell>
    );
  }

  if (element.type === "mods-installed-search") {
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <div className="installed-mods-mini-search-wrap hub-preview-installed-search">
            <Search size={13} className="installed-mods-mini-search-icon" aria-hidden />
            <div className="hub-preview-input-fake lp-input hub-search-field-input installed-mods-mini-search">
              {label || "Filtrar mods instalados…"}
            </div>
          </div>
        </PreviewShell>
    );
  }

  if (element.type === "mods-installed-list") {
    return (
        <PreviewShell element={element} scroll compact={compact} frameStyle={style}>
          <div className="installed-mods-list hub-preview-installed-list">
            <div className="installed-mods-list__header">
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <strong style={{ fontSize: 12, color: "#e8e9eb" }}>Mods instalados</strong>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>120/227</span>
              </div>
              <div className="lp-btn-sm installed-mods-list__refresh" aria-hidden>
                <RefreshCw size={12} />
              </div>
            </div>
            <ul className="installed-mods-list__items">
              {MOCK_INSTALLED_MODS.map((row) => (
                <li
                  key={row.fileName}
                  className={cn(
                    "installed-mod-card",
                    row.disabled && "installed-mod-card--disabled",
                    row.selected && "installed-mod-card--selected"
                  )}
                >
                  <div className="installed-mod-card__hit">
                    <div className="installed-mod-card__main">
                      <div className="installed-mod-card__text" style={{ minWidth: 0 }}>
                        <div className="installed-mod-card__title-row">
                          <span className="installed-mod-card__title" title={row.fileName}>
                            {row.displayName}
                          </span>
                          {row.hasUpdate && !row.disabled && (
                            <span className="installed-mod-card__badge installed-mod-card__badge--update">
                              Actualización
                            </span>
                          )}
                          {row.disabled && (
                            <span className="installed-mod-card__badge installed-mod-card__badge--off">
                              Off
                            </span>
                          )}
                        </div>
                        {row.displayName !== row.fileName && (
                          <div className="installed-mod-card__file">{row.fileName}</div>
                        )}
                      </div>
                      <span className="installed-mod-card__size">{formatPreviewBytes(row.size)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </PreviewShell>
    );
  }

  if (element.type === "mods-install-log") {
    return (
        <PreviewShell element={element} scroll compact={compact} frameStyle={style}>
          <div className="hub-preview-log">
            <div>[ok] Mod instalado</div>
            <div>[step] Descargando desde CurseForge…</div>
          </div>
        </PreviewShell>
    );
  }

  if (element.type === "instance-create-form") {
    return (
      <PreviewShell element={element} scroll compact={compact} frameStyle={style}>
        <div className="ih-form">
          <p className="ih-form-title">Nuevo perfil</p>
          <p className="ih-form-hint">Carpeta aislada con mods y guardados propios.</p>
          <div className="ih-input" aria-hidden>
            Nombre del perfil
          </div>
          <select className={cn(hubPillSelectClassName(resolvePillSelectStyle(element)), "hub-preview-pill-fill")} disabled aria-hidden>
            <option>1.20.1 Forge</option>
          </select>
          <button type="button" className="ih-btn" disabled>
            Crear perfil
          </button>
        </div>
      </PreviewShell>
    );
  }

  if (element.type === "instance-create-button") {
    return (
      <PreviewShell element={element} compact={compact} frameStyle={style}>
        <button type="button" className="ih-btn" disabled>
          {label || "Crear perfil"}
        </button>
      </PreviewShell>
    );
  }

  if (element.type === "instance-list") {
    const rows = MOCK_PROFILES.map((p, i) => {
      const [name, version] = p.label.split(" · ");
      const mockInst = {
        id: p.value,
        name: name?.trim() || p.label,
        iconColor: MOCK_INSTANCES[i]?.iconColor,
      };
      return { name, version: version?.trim() || "", mockInst, active: i === 0 };
    });
    return (
      <PreviewShell element={element} scroll compact={compact} frameStyle={style}>
        <ul className="ih-instance-list">
          {rows.map((row) => (
            <li key={row.mockInst.id} className={`ih-instance${row.active ? " active" : ""}`}>
              <button type="button" className="ih-instance-main" disabled>
                <span
                  className="ih-instance-dot"
                  style={{ background: resolveInstanceIconColor(row.mockInst) }}
                />
                <span className="ih-instance-text">
                  <strong>{row.name}</strong>
                  <small>{row.version}</small>
                </span>
                {row.active && <span className="ih-badge">Activo</span>}
              </button>
            </li>
          ))}
        </ul>
      </PreviewShell>
    );
  }

  if (element.type === "instance-active-card") {
    const active = MOCK_INSTANCES[0];
    return (
      <PreviewShell element={element} compact={compact} frameStyle={style}>
        <div className="ih-active-card">
          <span
            className="ih-instance-dot large"
            style={{ background: resolveInstanceIconColor({ id: active.id, name: active.name, iconColor: active.iconColor }) }}
          />
          <div>
            <p className="ih-active-label">Perfil activo</p>
            <p className="ih-active-name">{active.name}</p>
            <p className="ih-active-meta">Minecraft 1.20.1 · Forge</p>
          </div>
        </div>
      </PreviewShell>
    );
  }

  if (element.type === "launch-phase-label") {
    return (
      <PreviewShell element={element} compact={compact} frameStyle={style}>
        <span
          className="hub-preview-text hub-preview-phase-label"
          style={{
            color: textColor,
            fontSize: element.style.fontSize ?? 11,
            fontWeight: element.style.fontWeight ?? 600,
          }}
        >
          {label || "Sincronizando"}
        </span>
      </PreviewShell>
    );
  }

  if (element.type === "launch-version-title") {
    return (
      <PreviewShell element={element} compact={compact} frameStyle={style}>
        <span
          className="hub-preview-text"
          style={{
            color: textColor,
            fontSize: element.style.fontSize ?? 14,
            fontWeight: element.style.fontWeight ?? 600,
          }}
        >
          {label || "danilo · 1.16.5 Forge"}
        </span>
      </PreviewShell>
    );
  }

  if (element.type === "launch-detail-text") {
    return (
      <PreviewShell element={element} compact={compact} frameStyle={style}>
        <span
          className="hub-preview-text"
          style={{ color: textColor, fontSize: element.style.fontSize ?? 11 }}
        >
          {label || "Descargando librerías…"}
        </span>
      </PreviewShell>
    );
  }

  if (element.type === "launch-hint-text") {
    return (
      <PreviewShell element={element} compact={compact} frameStyle={style}>
        <span
          className="hub-preview-text hub-preview-launch-hint"
          style={{ color: textColor, fontSize: element.style.fontSize ?? 10 }}
        >
          {label || "Ocultar no cancela la descarga"}
        </span>
      </PreviewShell>
    );
  }

  if (element.type === "launch-error-block") {
    return (
      <PreviewShell element={element} compact={compact} frameStyle={style}>
        <span
          className="hub-preview-text hub-preview-error"
          style={{ fontSize: element.style.fontSize ?? 12 }}
        >
          {label || "Error de descarga"}
        </span>
      </PreviewShell>
    );
  }

  if (element.type === "launch-ok-hint") {
    return (
      <PreviewShell element={element} compact={compact} frameStyle={style}>
        <span
          className="hub-preview-text"
          style={{ color: textColor, fontSize: element.style.fontSize ?? 12 }}
        >
          {label || "¡Listo para jugar!"}
        </span>
      </PreviewShell>
    );
  }

  if (element.type.startsWith("launch-")) {
    const paneStyle = hubContentLayoutColumnStyle(element.style, element.type);
    return (
      <PreviewShell element={element} compact={compact} frameStyle={style}>
        <div className="hub-preview-pane" style={paneStyle}>
          <h4>{label || element.type.replace("launch-", "")}</h4>
          <p>Panel de lanzamiento</p>
          {element.type === "launch-log-panel" && (
            <div className="hub-preview-log">[info] Preparando Forge 1.16.5</div>
          )}
          {element.type === "launch-structured-log" && (
            <div className="hub-preview-log">[ok] Listo · [info] Descargando assets…</div>
          )}
        </div>
      </PreviewShell>
    );
  }

  if (element.type === "instance-avatar") {
    const active = MOCK_INSTANCES[0];
    const { layout } = resolveInstanceAvatarUi(element);
    const avatarSize = resolveInstanceAvatarRenderSize(element, layout);
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <div className="ih-instance-avatar-single-wrap">
            <PreviewInstanceAvatar
              name={active.name}
              iconColor={resolveInstanceIconColor({ id: active.id, name: active.name, iconColor: active.iconColor })}
              size={avatarSize}
            />
          </div>
        </PreviewShell>
    );
  }

  if (element.type === "instance-avatar-grid") {
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <PreviewInstanceAvatarList element={element} />
        </PreviewShell>
    );
  }

  if (element.type.startsWith("instance-")) {
    return (
      <PreviewShell element={element} scroll compact={compact} frameStyle={style}>
        <p className="ih-muted">{label || element.type}</p>
      </PreviewShell>
    );
  }

  if (
    element.type === "show-on-click" ||
    element.type === "show-on-condition" ||
    element.type === "hide-on-condition" ||
    element.type === "visibility-zone"
  ) {
    return (
        <PreviewShell element={element} compact={compact} frameStyle={style}>
          <div className="hub-preview-logic">
            <span>{label || element.type}</span>
          </div>
        </PreviewShell>
    );
  }

  return (
    <PreviewShell element={element} compact={compact} frameStyle={style}>
      <div className="hub-preview-compact">
        {Icon && <Icon className="h-3.5 w-3.5 text-[var(--color-accent)]" strokeWidth={1.5} />}
        <span>{label}</span>
      </div>
    </PreviewShell>
  );
}
