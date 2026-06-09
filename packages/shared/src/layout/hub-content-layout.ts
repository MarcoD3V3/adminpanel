import type { HubContentAlign, HubElementStyle, HubElementType } from "../types/hub-layout";

export const HUB_CONTENT_ALIGN_DEFAULT: HubContentAlign = "center";

export const HUB_CONTENT_ALIGN_X_OPTIONS = [
  { value: "start", label: "Inicio (izquierda)" },
  { value: "center", label: "Centro" },
  { value: "end", label: "Final (derecha)" },
] as const;

export const HUB_CONTENT_ALIGN_Y_OPTIONS = [
  { value: "start", label: "Inicio (arriba)" },
  { value: "center", label: "Centro" },
  { value: "end", label: "Final (abajo)" },
] as const;

export function resolveHubContentAlignX(style: HubElementStyle | undefined): HubContentAlign {
  return style?.contentAlignX ?? HUB_CONTENT_ALIGN_DEFAULT;
}

export function resolveHubContentAlignY(style: HubElementStyle | undefined): HubContentAlign {
  return style?.contentAlignY ?? HUB_CONTENT_ALIGN_DEFAULT;
}

function toFlexAlign(value: HubContentAlign): string {
  if (value === "start") return "flex-start";
  if (value === "end") return "flex-end";
  return "center";
}

/** Catálogo de mods: el contenido debe rellenar el bounding box del elemento (WYSIWYG). */
export const HUB_STRETCH_CONTENT_ELEMENT_TYPES = new Set<HubElementType>([
  "mods-tabs",
  "mods-search",
  "mods-results",
  "mods-catalog",
  "mods-preview",
  "mods-installed-search",
  "mods-installed-list",
  "mods-install-log",
]);

/** Flex para posicionar el contenido hijo dentro del área del elemento. */
export function hubContentLayoutStyle(
  style: HubElementStyle | undefined,
  elementType?: HubElementType
): Record<string, string> {
  if (elementType && HUB_STRETCH_CONTENT_ELEMENT_TYPES.has(elementType)) {
    const row = elementType === "mods-tabs";
    return {
      display: "flex",
      flexDirection: row ? "row" : "column",
      flexWrap: "nowrap",
      justifyContent: "flex-start",
      alignItems: "stretch",
      width: "100%",
      height: "100%",
      minHeight: "0",
      minWidth: "0",
    };
  }

  return {
    display: "flex",
    flexDirection: "row",
    flexWrap: "nowrap",
    justifyContent: toFlexAlign(resolveHubContentAlignX(style)),
    alignItems: toFlexAlign(resolveHubContentAlignY(style)),
  };
}

/** Flex en columna (paneles con varias líneas): X → alignItems, Y → justifyContent. */
export function hubContentLayoutColumnStyle(
  style: HubElementStyle | undefined,
  elementType?: HubElementType
): Record<string, string> {
  if (elementType && HUB_STRETCH_CONTENT_ELEMENT_TYPES.has(elementType)) {
    const row = elementType === "mods-tabs";
    return {
      display: "flex",
      flexDirection: row ? "row" : "column",
      flexWrap: "nowrap",
      justifyContent: "flex-start",
      alignItems: "stretch",
      width: "100%",
      height: "100%",
      minHeight: "0",
      minWidth: "0",
    };
  }

  return {
    display: "flex",
    flexDirection: "column",
    flexWrap: "nowrap",
    alignItems: toFlexAlign(resolveHubContentAlignX(style)),
    justifyContent: toFlexAlign(resolveHubContentAlignY(style)),
  };
}
