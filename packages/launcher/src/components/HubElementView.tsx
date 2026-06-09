import type React from "react";
import type { HubElement } from "@craftlauncher/shared";
import {
  DEFAULT_HUB_PLAY_BG,
  DEFAULT_HUB_SURFACE_BG,
  FORGE_VERSIONS,
  resolveForgeVersion,
  hubContentLayoutStyle,
  hubElementCssForceClasses,
  hubElementCssToStyle,
  resolveEffectiveHubCss,
  resolveHubBackgroundColor,
  resolveHubTextColor,
  hubVisualRootProps,
  hubFillControlBtnProps,
  hubTextStyleClassForElement,
  hubTextStyleInlineCss,
  resolvePillSelectStyle,
} from "@craftlauncher/shared";
import { HubElementIcon } from "./HubElementIcon";
import { ModsCatalogSurface } from "./mod-catalog/ModsCatalogSurface";
import { ModsTabsHub } from "./mod-catalog/hub/ModsTabsHub";
import { ModsSearchHub } from "./mod-catalog/hub/ModsSearchHub";
import { ModsResultsHub } from "./mod-catalog/hub/ModsResultsHub";
import { ModsPreviewHub } from "./mod-catalog/hub/ModsPreviewHub";
import { ModsInstallLogHub } from "./mod-catalog/hub/ModsInstallLogHub";
import { ModsInstalledListHub } from "./mod-catalog/hub/ModsInstalledListHub";
import { ModsInstalledSearchHub } from "./mod-catalog/hub/ModsInstalledSearchHub";
import {
  InstanceActiveCardHub,
  InstanceCreateButtonHub,
  InstanceCreateFormHub,
  InstanceListHub,
  InstanceNameInputHub,
  InstanceVersionSelectHub,
} from "./instances-hub/InstancesHubPanels";
import { InstanceAvatarHub } from "./instances-hub/InstanceAvatarHub";
import { InstanceAvatarGridHub } from "./instances-hub/InstanceAvatarGridHub";
import { InstanceSelectorHub, InstalledVersionSelectorHub } from "./instances-hub/InstanceSelectorsHub";
import { HubPillSelect } from "./hub/HubPillSelect";
import {
  LaunchDetailTextHub,
  LaunchDesktopWindowToggleHub,
  LaunchDismissButtonHub,
  LaunchErrorBlockHub,
  LaunchHintTextHub,
  LaunchLogPanelHub,
  LaunchOkHintHub,
  LaunchPanelHub,
  LaunchPhaseLabelHub,
  LaunchProgressBarHub,
  LaunchStructuredLogHub,
  LaunchVersionTitleHub,
} from "./launch-hub/LaunchHubWidgets";
import { MinecraftStatusChip } from "./automation-hub/MinecraftStatusChip";
import { PanelVisibilitySelectHub } from "./automation-hub/PanelVisibilitySelectHub";
import { HubElementShell } from "./hub/HubElementShell";

function cssToStyle(css: HubElement["css"]): React.CSSProperties {
  return hubElementCssToStyle(css) as React.CSSProperties;
}

interface HubElementProps {
  element: HubElement;
  allElements?: HubElement[];
  onClick?: () => void;
  onChange?: (value: string | number | boolean) => void;
  /** Si true, se renderiza en flujo (no absolute). */
  flow?: boolean;
  /** Si true, ocupa todo el padre (sin left/top). */
  fillParent?: boolean;
}

export function HubElementView({ element, allElements, onClick, onChange, flow, fillParent }: HubElementProps) {
  const pool = allElements?.length ? allElements : [element];
  const effectiveElement = { ...element, css: resolveEffectiveHubCss(element, pool) };
  const cssStyle = cssToStyle(effectiveElement.css);
  if (!element.visible) return null;

  const textColor = resolveHubTextColor(element.style.textColor);
  const bg = resolveHubBackgroundColor(element.style.backgroundColor, DEFAULT_HUB_SURFACE_BG);
  const radius = element.style.borderRadius ?? 10;
  const fontSize = element.style.fontSize ?? 13;
  const fontWeight = element.style.fontWeight ?? "normal";

  const boxStyle: React.CSSProperties = fillParent
    ? {
        width: "100%",
        height: "100%",
        borderRadius: radius,
        position: "absolute",
        inset: 0,
        overflow: "hidden",
      }
    : flow
    ? {
        width: element.width,
        height: element.height,
        borderRadius: radius,
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }
    : {
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        zIndex: element.zIndex,
        borderRadius: radius,
        position: "absolute",
        overflow: "hidden",
      };

  const wrapFrame = (
    extra: React.CSSProperties,
    className?: string
  ): { className?: string; style: React.CSSProperties } => {
    const root = hubVisualRootProps(effectiveElement, {
      className:
        [className, hubTextStyleClassForElement(element), hubElementCssForceClasses(effectiveElement)]
          .filter(Boolean)
          .join(" ") || undefined,
      style: {
        ...boxStyle,
        ...extra,
      } as Record<string, string | number>,
    });
    return { className: root.className, style: root.style as React.CSSProperties };
  };

  const wrapFillControlFrame = (extra: React.CSSProperties = {}): { className?: string; style: React.CSSProperties } => {
    const root = hubVisualRootProps(effectiveElement, {
      className: hubElementCssForceClasses(effectiveElement) || undefined,
      style: {
        ...boxStyle,
        background: "transparent",
        ...extra,
      } as Record<string, string | number>,
    });
    return { className: root.className, style: root.style as React.CSSProperties };
  };

  const renderFillControl = (
    btnClassName: string,
    classicStyle: Record<string, string | number | undefined>,
    children: React.ReactNode,
    options?: {
      tag?: "button" | "div";
      frameStyle?: React.CSSProperties;
      ariaLabel?: string;
      title?: string;
    }
  ) => {
    const btn = hubFillControlBtnProps(effectiveElement, btnClassName, classicStyle);
    const frame = wrapFillControlFrame(options?.frameStyle);
    const Tag = options?.tag ?? "button";
    const interactive = Tag === "button" ? { type: "button" as const, ...clickProps } : clickProps;
    return (
      <div className={frame.className} style={frame.style}>
        <Tag
          {...interactive}
          className={btn.className}
          style={btn.style as React.CSSProperties}
          title={options?.title}
          aria-label={options?.ariaLabel}
        >
          {children}
        </Tag>
      </div>
    );
  };

  const lhWrap = (extra: React.CSSProperties = { background: "transparent", ...cssStyle }) => {
    const frame = wrapFrame(extra);
    return {
      className: ["lh-hub-wrap", frame.className].filter(Boolean).join(" ") || "lh-hub-wrap",
      style: frame.style,
      "data-hub-el": element.id,
    };
  };

  const clickProps = onClick
    ? {
        role: "button" as const,
        tabIndex: 0,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onClick();
        },
      }
    : {};

  if (element.type === "mods-catalog") {
    return (
      <div {...wrapFrame({ background: "transparent", ...cssStyle })}>
        <HubElementShell element={element} scroll style={{ display: "flex", flexDirection: "column" }}>
          <ModsCatalogSurface />
        </HubElementShell>
      </div>
    );
  }

  if (element.type === "mods-tabs") {
    return (
      <div
        {...wrapFrame({
          background: element.style.backgroundColor ? bg : "transparent",
          color: textColor,
          fontSize,
          fontWeight,
          ...cssStyle,
        })}
      >
        <HubElementShell element={element}>
          <ModsTabsHub />
        </HubElementShell>
      </div>
    );
  }

  if (element.type === "mods-search") {
    return (
      <div
        {...wrapFrame({
          background: element.style.backgroundColor ? bg : "transparent",
          color: textColor,
          fontSize,
          fontWeight,
          ...cssStyle,
        })}
      >
        <HubElementShell element={element}>
          <ModsSearchHub />
        </HubElementShell>
      </div>
    );
  }

  if (element.type === "mods-results") {
    return (
      <div
        {...wrapFrame({
          background: element.style.backgroundColor ? bg : "transparent",
          color: textColor,
          fontSize,
          fontWeight,
          ...cssStyle,
        })}
      >
        <HubElementShell element={element} scroll>
          <ModsResultsHub element={element} />
        </HubElementShell>
      </div>
    );
  }

  if (element.type === "mods-preview") {
    return (
      <div {...wrapFrame({ background: "transparent", ...cssStyle })}>
        <HubElementShell element={element} scroll>
          <ModsPreviewHub />
        </HubElementShell>
      </div>
    );
  }

  if (element.type === "mods-install-log") {
    return (
      <div {...wrapFrame({ background: "transparent", ...cssStyle })}>
        <HubElementShell element={element} scroll>
          <ModsInstallLogHub />
        </HubElementShell>
      </div>
    );
  }

  if (element.type === "mods-installed-list") {
    return (
      <div {...wrapFrame({ background: "transparent", ...cssStyle })}>
        <HubElementShell element={element} scroll>
          <ModsInstalledListHub />
        </HubElementShell>
      </div>
    );
  }

  if (element.type === "mods-installed-search") {
    return (
      <div {...wrapFrame({ background: "transparent", ...cssStyle })}>
        <HubElementShell element={element}>
          <ModsInstalledSearchHub element={element} />
        </HubElementShell>
      </div>
    );
  }

  if (element.type === "instance-create-form") {
    return (
      <div {...wrapFrame({ background: "transparent", ...cssStyle })}>
        <HubElementShell element={element} scroll>
          <InstanceCreateFormHub />
        </HubElementShell>
      </div>
    );
  }

  if (element.type === "instance-list") {
    return (
      <div {...wrapFrame({ background: "transparent", ...cssStyle })}>
        <HubElementShell element={element} scroll>
          <InstanceListHub />
        </HubElementShell>
      </div>
    );
  }

  if (element.type === "instance-active-card") {
    return (
      <div {...wrapFrame({ background: "transparent", ...cssStyle })}>
        <HubElementShell element={element}>
          <InstanceActiveCardHub />
        </HubElementShell>
      </div>
    );
  }

  if (element.type === "instance-avatar") {
    return (
      <div {...wrapFrame({ background: "transparent", ...cssStyle })}>
        <HubElementShell element={element}>
          <InstanceAvatarHub element={element} />
        </HubElementShell>
      </div>
    );
  }

  if (element.type === "instance-avatar-grid") {
    return (
      <div {...wrapFrame({ background: "transparent", ...cssStyle })}>
        <HubElementShell element={element}>
          <InstanceAvatarGridHub element={element} />
        </HubElementShell>
      </div>
    );
  }

  if (element.type === "instance-name-input") {
    return (
      <div {...wrapFrame({ background: "transparent", ...cssStyle })}>
        <HubElementShell element={element}>
          <InstanceNameInputHub />
        </HubElementShell>
      </div>
    );
  }

  if (element.type === "instance-version-select") {
    const pillStyle = resolvePillSelectStyle(element);
    return (
      <div {...wrapFrame({ background: "transparent", ...cssStyle })}>
        <HubElementShell element={element}>
          <InstanceVersionSelectHub styleVariant={pillStyle} />
        </HubElementShell>
      </div>
    );
  }

  if (element.type === "instance-selector") {
    const pillStyle = resolvePillSelectStyle(element);
    return (
      <div {...wrapFrame({ background: "transparent", ...cssStyle })}>
        <HubElementShell element={element}>
          <InstanceSelectorHub
            value={String(element.value ?? "")}
            styleVariant={pillStyle}
            backgroundColor={element.style.backgroundColor}
            onChange={(id) => onChange?.(id)}
          />
        </HubElementShell>
      </div>
    );
  }

  if (element.type === "installed-version-selector") {
    const pillStyle = resolvePillSelectStyle(element);
    return (
      <div {...wrapFrame({ background: "transparent", ...cssStyle })}>
        <HubElementShell element={element}>
          <InstalledVersionSelectorHub
            value={String(element.value ?? "")}
            styleVariant={pillStyle}
            onChange={(id) => onChange?.(id)}
          />
        </HubElementShell>
      </div>
    );
  }

  if (element.type === "instance-create-button") {
    return (
      <div {...wrapFrame({ background: "transparent", ...cssStyle })}>
        <HubElementShell element={element}>
          <InstanceCreateButtonHub label={element.label || "Crear perfil"} />
        </HubElementShell>
      </div>
    );
  }

  if (element.type === "launch-panel") {
    return (
      <div {...lhWrap()}>
        <HubElementShell element={element}>
          <LaunchPanelHub />
        </HubElementShell>
      </div>
    );
  }
  if (element.type === "launch-version-title") {
    return (
      <div {...lhWrap()}>
        <HubElementShell element={element}>
          <LaunchVersionTitleHub />
        </HubElementShell>
      </div>
    );
  }
  if (element.type === "launch-phase-label") {
    return (
      <div {...lhWrap()}>
        <HubElementShell element={element}>
          <LaunchPhaseLabelHub />
        </HubElementShell>
      </div>
    );
  }
  if (element.type === "launch-detail-text") {
    return (
      <div {...lhWrap()}>
        <HubElementShell element={element}>
          <LaunchDetailTextHub />
        </HubElementShell>
      </div>
    );
  }
  if (element.type === "launch-progress-bar") {
    return (
      <div {...lhWrap()}>
        <HubElementShell element={element}>
          <LaunchProgressBarHub />
        </HubElementShell>
      </div>
    );
  }
  if (element.type === "launch-log-panel") {
    return (
      <div {...lhWrap()}>
        <HubElementShell element={element} scroll>
          <LaunchLogPanelHub defaultOpen />
        </HubElementShell>
      </div>
    );
  }
  if (element.type === "launch-hint-text") {
    return (
      <div {...lhWrap()}>
        <HubElementShell element={element}>
          <LaunchHintTextHub label={element.label} />
        </HubElementShell>
      </div>
    );
  }
  if (element.type === "launch-dismiss-button") {
    return (
      <div {...lhWrap()}>
        <HubElementShell element={element}>
          <LaunchDismissButtonHub label={element.label || undefined} />
        </HubElementShell>
      </div>
    );
  }
  if (element.type === "launch-structured-log") {
    return (
      <div {...lhWrap()}>
        <HubElementShell element={element} scroll>
          <LaunchStructuredLogHub defaultOpen />
        </HubElementShell>
      </div>
    );
  }
  if (element.type === "launch-error-block") {
    return (
      <div {...lhWrap()}>
        <HubElementShell element={element}>
          <LaunchErrorBlockHub />
        </HubElementShell>
      </div>
    );
  }
  if (element.type === "launch-ok-hint") {
    return (
      <div {...lhWrap()}>
        <HubElementShell element={element}>
          <LaunchOkHintHub />
        </HubElementShell>
      </div>
    );
  }
  if (element.type === "launch-desktop-window-toggle") {
    return (
      <div {...lhWrap()}>
        <HubElementShell element={element}>
          <LaunchDesktopWindowToggleHub label={element.label || undefined} />
        </HubElementShell>
      </div>
    );
  }

  if (element.type === "automation-node") return null;

  if (element.type === "minecraft-status-chip") {
    return (
      <div {...lhWrap()}>
        <MinecraftStatusChip label={element.label || undefined} />
      </div>
    );
  }

  if (element.type === "panel-visibility-select") {
    return (
      <div {...lhWrap()}>
        <PanelVisibilitySelectHub element={element} label={element.label || "Mostrar panel"} />
      </div>
    );
  }

  if (element.type === "play-show-bind") {
    const playBg = resolveHubBackgroundColor(
      element.style.backgroundColor,
      bg === DEFAULT_HUB_SURFACE_BG ? DEFAULT_HUB_PLAY_BG : bg
    );
    return (
      <button
        type="button"
        {...clickProps}
        {...wrapFrame(
          {
            ...hubControlButtonChrome(element, {
              background: playBg,
              color: textColor,
              fontSize,
              fontWeight,
            }),
            cursor: "pointer",
            width: "100%",
            height: "100%",
            ...cssStyle,
          },
          ["hub-play", "hub-play-bind"].filter(Boolean).join(" ")
        )}
      >
        {element.label || "Jugar"}
      </button>
    );
  }

  if (element.type === "show-on-click" || element.type === "action-chip") {
    return (
      <button
        type="button"
        {...clickProps}
        {...wrapFrame(
          {
            background: bg,
            color: textColor,
            fontSize,
            fontWeight,
            border: "none",
            cursor: "pointer",
            width: "100%",
            height: "100%",
            ...cssStyle,
          },
          "hub-action-chip"
        )}
      >
        {element.label || (element.type === "show-on-click" ? "Mostrar" : "Acción")}
      </button>
    );
  }

  if (element.type === "toggle-visible") {
    return (
      <button
        type="button"
        {...clickProps}
        {...wrapFrame({
          background: bg,
          color: textColor,
          fontSize,
          fontWeight,
          border: "none",
          cursor: "pointer",
          width: "100%",
          height: "100%",
          ...cssStyle,
        })}
      >
        {element.label || "Alternar panel"}
      </button>
    );
  }

  if (element.type === "text") {
    const textClass = hubTextStyleClassForElement(element);
    return (
      <div
        {...wrapFrame({
          color: textColor,
          fontSize,
          fontWeight,
          ...hubContentLayoutStyle(element.style),
          ...cssStyle,
        })}
      >
        <span
          className={textClass || undefined}
          style={{ maxWidth: "100%", ...(hubTextStyleInlineCss(element) as React.CSSProperties) }}
        >
          {element.label}
        </span>
      </div>
    );
  }

  if (element.type === "play-button" || element.type === "button" || element.type === "script-button") {
    const playBg = resolveHubBackgroundColor(element.style.backgroundColor, DEFAULT_HUB_PLAY_BG);
    const surfaceBg = resolveHubBackgroundColor(element.style.backgroundColor, DEFAULT_HUB_SURFACE_BG);
    const isPlay = element.type === "play-button";
    return renderFillControl(
      isPlay ? "hub-preview-btn hub-preview-btn--play hub-preview-btn--fill" : "hub-preview-btn secondary hub-preview-btn--fill",
      {
        background: isPlay ? playBg : surfaceBg,
        color: textColor,
        fontSize,
        fontWeight,
        borderRadius: radius,
        cursor: "pointer",
      },
      element.label
    );
  }

  if (element.type === "counter") {
    const n = typeof element.value === "number" ? element.value : element.label;
    return (
      <div
        {...clickProps}
        {...wrapFrame({
          background: bg,
          ...hubContentLayoutStyle(element.style),
          color: textColor,
          fontSize: fontSize ?? 24,
          fontWeight: "bold",
          cursor: onClick ? "pointer" : "default",
          ...cssStyle,
        })}
      >
        {n}
      </div>
    );
  }

  if (element.type === "input-field") {
    return (
      <div {...wrapFrame({ background: "transparent", ...cssStyle })}>
        <HubElementShell element={element}>
          <input
            className="lp-input hub-search-field-input"
            style={{ color: textColor, fontSize, padding: "0 10px" }}
            value={String(element.value ?? "")}
            placeholder={element.label}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onChange?.(e.target.value)}
          />
        </HubElementShell>
      </div>
    );
  }

  if (element.type === "toggle" || element.type === "checkbox") {
    const checked = Boolean(element.value);
    return (
      <label
        {...clickProps}
        {...wrapFrame({
          background: bg,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 10px",
          color: textColor,
          cursor: "pointer",
          ...cssStyle,
        })}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
        />
        {element.label}
      </label>
    );
  }

  if (element.type === "version-selector" || element.type === "dropdown") {
    const options =
      element.type === "version-selector"
        ? FORGE_VERSIONS.map((v) => ({ value: v.id, label: v.label }))
        : String(element.logic?.constants?.OPTIONS ?? element.label)
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean)
            .map((o) => ({ value: o, label: o }));
    const current = resolveForgeVersion(
      String(element.value ?? options[0]?.value ?? "1.20.1")
    ).id;
    return (
      <div {...wrapFrame({ background: "transparent", ...cssStyle })}>
        <HubPillSelect
          value={current}
          options={options}
          styleVariant={resolvePillSelectStyle(element)}
          onChange={(v) => onChange?.(v)}
        />
      </div>
    );
  }

  if (element.type === "image" && element.imageUrl) {
    return (
      <div
        {...wrapFrame({
          backgroundImage: `url(${element.imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          ...cssStyle,
        })}
      />
    );
  }

  if (element.type === "profile-widget") {
    const tier = String(element.value ?? "");
    return (
      <div
        {...clickProps}
        {...wrapFrame({
          background: bg,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 14px",
          color: textColor,
          cursor: onClick ? "pointer" : "default",
          ...cssStyle,
        })}
      >
        <span style={{ fontSize: 14, fontWeight: 600 }}>{element.label}</span>
        {tier && <span style={{ fontSize: 11, color: "#8b8d92", marginTop: 4 }}>{tier}</span>}
      </div>
    );
  }

  if (element.type === "icon-button" || element.type === "toast-trigger") {
    const iconBg = resolveHubBackgroundColor(element.style.backgroundColor, "transparent");
    const iconSize = Math.max(12, Math.min(24, Math.round(Math.min(element.width, element.height) * 0.45)));
    return renderFillControl(
      "hub-preview-icon-btn hub-preview-btn--fill",
      {
        background: iconBg,
        color: textColor,
        borderRadius: radius,
        cursor: onClick ? "pointer" : "default",
      },
      <HubElementIcon element={element} size={iconSize} strokeWidth={2} />,
      {
        tag: "div",
        ariaLabel: element.label || undefined,
        title: element.label || undefined,
      }
    );
  }

  if (element.type === "nav-item") {
    return renderFillControl(
      "hub-preview-btn secondary hub-preview-btn--fill",
      {
        background: resolveHubBackgroundColor(element.style.backgroundColor, "transparent"),
        color: textColor,
        fontSize,
        fontWeight,
        borderRadius: radius,
        textAlign: "left",
        padding: "0 12px",
        cursor: "pointer",
      },
      element.label
    );
  }

  return (
    <div
      {...clickProps}
      {...wrapFrame({
        background: bg,
        color: textColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize,
        cursor: onClick ? "pointer" : "default",
        ...cssStyle,
      })}
    >
      {element.label}
    </div>
  );
}
