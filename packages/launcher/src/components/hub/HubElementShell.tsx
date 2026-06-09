import type { CSSProperties, ReactNode } from "react";
import type { HubElement } from "@craftlauncher/shared";
import {
  SEARCH_FIELD_ELEMENT_TYPES,
  hubContentLayoutStyle,
  hubElementSurfaceWrapperClass,
  hubElementUiCssVars,
  hubTextStyleClassForElement,
  hubTextStyleInlineCss,
  hubSearchFieldClassName,
  resolveHubElementUi,
  resolveSearchFieldStyle,
} from "@craftlauncher/shared";

type HubElementShellProps = {
  element: HubElement;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  scroll?: boolean;
};

export function HubElementShell({ element, children, style, className, scroll }: HubElementShellProps) {
  const ui = resolveHubElementUi(element);
  const scrollClass = ui.hideScrollbar ? "hub-scroll-hidden" : "";
  const outerClass = [scrollClass, className].filter(Boolean).join(" ") || undefined;
  const innerClass = ["hub-content-scaled", "hub-runtime-content", ui.hideScrollbar ? "hub-scroll-hidden" : "", hubTextStyleClassForElement(element)]
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

  return (
    <div
      className={outerClass}
      style={{
        width: "100%",
        height: "100%",
        overflow: scroll ? ui.scrollY : style?.overflow ?? "hidden",
        boxSizing: "border-box",
        ...style,
      }}
    >
      <div
        className={innerClass}
        style={{
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          fontSize: element.style.fontSize ?? 13,
          color: element.style.textColor,
          borderRadius: element.style.borderRadius,
          zoom: ui.contentScale !== 1 ? ui.contentScale : undefined,
          ...hubContentLayoutStyle(element.style, element.type),
          ...(hubElementUiCssVars(element) as CSSProperties),
          ...(hubTextStyleInlineCss(element) as CSSProperties),
        }}
      >
        {wrapChildren(children)}
      </div>
    </div>
  );
}
