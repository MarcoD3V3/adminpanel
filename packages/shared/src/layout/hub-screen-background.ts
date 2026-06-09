import type { HubScreen } from "../types/hub-layout";

export type HubBackgroundImageFit = "cover" | "contain" | "stretch" | "repeat";

export const HUB_BACKGROUND_IMAGE_FIT_OPTIONS: { value: HubBackgroundImageFit; label: string }[] = [
  { value: "cover", label: "Cubrir (cover)" },
  { value: "contain", label: "Contener (contain)" },
  { value: "stretch", label: "Estirar" },
  { value: "repeat", label: "Repetir (mosaico)" },
];

export type HubBackgroundChromeStyle =
  | "solid"
  | "extend"
  | "blur"
  | "transparent"
  | "tint"
  | "gradient"
  | "frosted"
  | "glass"
  | "shadow"
  | "color-tint";

export const HUB_BACKGROUND_CHROME_STYLE_DEFAULT: HubBackgroundChromeStyle = "solid";

export const HUB_BACKGROUND_CHROME_STYLE_OPTIONS: { value: HubBackgroundChromeStyle; label: string }[] =
  [
    { value: "solid", label: "Barra separada (color propio)" },
    { value: "extend", label: "Fondo continuo (toda la ventana)" },
    { value: "blur", label: "Barra con blur al fondo" },
    { value: "transparent", label: "Barra transparente" },
    { value: "tint", label: "Barra con velo oscuro" },
    { value: "gradient", label: "Degradado bajo la barra" },
    { value: "frosted", label: "Cristal esmerilado" },
    { value: "glass", label: "Cristal intenso" },
    { value: "shadow", label: "Sombra suave bajo la barra" },
    { value: "color-tint", label: "Tinte con color de fondo" },
  ];

/** Modos que exponen el control de desenfoque (px). */
export const HUB_CHROME_BLUR_STYLE_MODES = new Set<HubBackgroundChromeStyle>([
  "blur",
  "frosted",
  "glass",
]);

/** Modos que exponen el control de intensidad del velo (%). */
export const HUB_CHROME_OPACITY_STYLE_MODES = new Set<HubBackgroundChromeStyle>([
  "blur",
  "tint",
  "gradient",
  "frosted",
  "glass",
  "shadow",
  "color-tint",
]);

export type HubScreenBackgroundInput = Pick<
  HubScreen,
  | "backgroundColor"
  | "backgroundImage"
  | "backgroundImageFit"
  | "backgroundImagePosition"
  | "backgroundChromeStyle"
  | "backgroundChromeBlur"
  | "backgroundChromeOpacity"
>;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function resolveBackgroundChromeStyle(
  screen: Pick<HubScreen, "backgroundChromeStyle"> | undefined
): HubBackgroundChromeStyle {
  return screen?.backgroundChromeStyle ?? HUB_BACKGROUND_CHROME_STYLE_DEFAULT;
}

/** El fondo se extiende detrás de la barra superior (no solo el área de contenido). */
export function backgroundExtendsIntoChrome(style?: HubBackgroundChromeStyle): boolean {
  return (style ?? HUB_BACKGROUND_CHROME_STYLE_DEFAULT) !== "solid";
}

/** Normaliza URL o ruta local del fondo. */
export function normalizeHubBackgroundImageUrl(raw: string | undefined): string | undefined {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return undefined;
  return trimmed;
}

function cssUrl(value: string): string {
  const safe = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `url("${safe}")`;
}

export type HubBackgroundResolveOptions = {
  /** Base del admin (p. ej. http://localhost:3000) para proxy en runtime Electron. */
  proxyBaseUrl?: string;
};

function proxyBackgroundUrl(base: string, target: string): string {
  const root = base.replace(/\/$/, "");
  return `${root}/api/hub-background?url=${encodeURIComponent(target)}`;
}

/** Proxy en editor y launcher para evitar bloqueos hotlink de sitios externos. */
export function resolveHubBackgroundImageUrl(
  raw: string | undefined,
  context: "editor" | "runtime",
  options?: HubBackgroundResolveOptions
): string | undefined {
  const normalized = normalizeHubBackgroundImageUrl(raw);
  if (!normalized) return undefined;

  if (normalized.startsWith("/") && options?.proxyBaseUrl) {
    return `${options.proxyBaseUrl.replace(/\/$/, "")}${normalized}`;
  }

  if (/^https?:\/\//i.test(normalized)) {
    if (context === "editor") {
      return `/api/hub-background?url=${encodeURIComponent(normalized)}`;
    }
    if (options?.proxyBaseUrl) {
      return proxyBackgroundUrl(options.proxyBaseUrl, normalized);
    }
  }

  return normalized;
}

function fitToCss(fit: HubBackgroundImageFit | undefined): {
  backgroundSize: string;
  backgroundRepeat: string;
  backgroundPosition: string;
} {
  const position = "center";
  switch (fit ?? "cover") {
    case "contain":
      return { backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: position };
    case "stretch":
      return { backgroundSize: "100% 100%", backgroundRepeat: "no-repeat", backgroundPosition: position };
    case "repeat":
      return { backgroundSize: "auto", backgroundRepeat: "repeat", backgroundPosition: "top left" };
    case "cover":
    default:
      return { backgroundSize: "cover", backgroundRepeat: "no-repeat", backgroundPosition: position };
  }
}

export function hubScreenBackgroundStyle(
  screen: HubScreenBackgroundInput,
  context: "editor" | "runtime" = "runtime",
  options?: HubBackgroundResolveOptions
): Record<string, string> {
  const style: Record<string, string> = {};
  if (screen.backgroundColor) style.backgroundColor = screen.backgroundColor;

  const imageUrl = resolveHubBackgroundImageUrl(screen.backgroundImage, context, options);
  if (imageUrl) {
    style.backgroundImage = cssUrl(imageUrl);
    const fit = fitToCss(screen.backgroundImageFit);
    style.backgroundSize = fit.backgroundSize;
    style.backgroundRepeat = fit.backgroundRepeat;
    style.backgroundPosition = screen.backgroundImagePosition?.trim() || fit.backgroundPosition;
  }

  return style;
}

/** Fondo unificado (barra + contenido) en el marco de la ventana. */
export function hubWindowFrameBackgroundStyle(
  screen: HubScreenBackgroundInput & { height: number },
  _chromeHeight: number,
  context: "editor" | "runtime" = "runtime",
  options?: HubBackgroundResolveOptions
): Record<string, string> {
  if (!backgroundExtendsIntoChrome(resolveBackgroundChromeStyle(screen))) {
    return {};
  }

  if (normalizeHubBackgroundImageUrl(screen.backgroundImage)) {
    return hubScreenBackgroundStyle(screen, context, options);
  }

  const style: Record<string, string> = {};
  if (screen.backgroundColor) style.backgroundColor = screen.backgroundColor;
  return style;
}

/** Superficie de la barra superior según el modo de integración con el fondo. */
export function hubChromeBarSurfaceStyle(
  screen: Pick<
    HubScreen,
    "backgroundChromeStyle" | "backgroundChromeBlur" | "backgroundChromeOpacity" | "backgroundColor"
  >
): Record<string, string> {
  const mode = resolveBackgroundChromeStyle(screen);
  const opacity = clampNumber(screen.backgroundChromeOpacity ?? 55, 0, 100) / 100;
  const blurPx = clampNumber(screen.backgroundChromeBlur ?? 12, 0, 48);

  switch (mode) {
    case "solid":
      return {};
    case "extend":
    case "transparent":
      return { background: "transparent" };
    case "blur":
      return {
        background: `rgba(10, 11, 13, ${opacity * 0.5})`,
        backdropFilter: `blur(${blurPx}px)`,
        WebkitBackdropFilter: `blur(${blurPx}px)`,
      };
    case "tint":
      return { background: `rgba(10, 11, 13, ${opacity})` };
    case "gradient":
      return {
        background: `linear-gradient(to bottom, rgba(10, 11, 13, ${opacity * 0.25}) 0%, rgba(10, 11, 13, ${opacity}) 100%)`,
      };
    case "frosted":
      return {
        background: `rgba(255, 255, 255, ${opacity * 0.14})`,
        backdropFilter: `blur(${blurPx}px) saturate(1.15)`,
        WebkitBackdropFilter: `blur(${blurPx}px) saturate(1.15)`,
      };
    case "glass":
      return {
        background: `rgba(255, 255, 255, ${opacity * 0.08})`,
        backdropFilter: `blur(${Math.round(blurPx * 1.4)}px) brightness(1.06)`,
        WebkitBackdropFilter: `blur(${Math.round(blurPx * 1.4)}px) brightness(1.06)`,
      };
    case "shadow":
      return {
        background: "transparent",
        boxShadow: `0 8px 28px rgba(0, 0, 0, ${opacity * 0.45})`,
      };
    case "color-tint": {
      const tint = screen.backgroundColor?.trim() || "#0a0b0d";
      return {
        background: `color-mix(in srgb, ${tint} ${Math.round(opacity * 100)}%, transparent)`,
      };
    }
    default:
      return {};
  }
}

/** Fondo del área de contenido; transparente si el marco ya lleva el wallpaper. */
export function hubScreenContentBackgroundStyle(
  screen: HubScreenBackgroundInput,
  context: "editor" | "runtime" = "runtime",
  options?: HubBackgroundResolveOptions
): Record<string, string> {
  if (backgroundExtendsIntoChrome(resolveBackgroundChromeStyle(screen))) {
    return { backgroundColor: "transparent" };
  }
  return hubScreenBackgroundStyle(screen, context, options);
}

export function looksLikeDirectImageUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (u.startsWith("/") || u.startsWith("data:image/")) return true;
  return /\.(avif|bmp|gif|jpe?g|png|svg|webp)(\?.*)?$/i.test(u);
}
