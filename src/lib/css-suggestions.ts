export type CssSuggestion = {
  key: string;
  group:
    | "layout"
    | "box"
    | "text"
    | "background"
    | "flex"
    | "grid"
    | "effects"
    | "misc";
  examples?: string[];
};

// Lista curada (extensible). Mantener keys en camelCase (React style) porque
// el runtime aplica esto directo a `style={{ ... }}`.
export const CSS_SUGGESTIONS: CssSuggestion[] = [
  // Layout / position
  { key: "display", group: "layout", examples: ["flex", "grid", "block", "inline", "none"] },
  { key: "position", group: "layout", examples: ["relative", "absolute", "fixed", "sticky"] },
  { key: "top", group: "layout", examples: ["0", "12px", "10%"] },
  { key: "right", group: "layout", examples: ["0", "12px"] },
  { key: "bottom", group: "layout", examples: ["0", "12px"] },
  { key: "left", group: "layout", examples: ["0", "12px"] },
  { key: "inset", group: "layout", examples: ["0", "10px"] },
  { key: "zIndex", group: "layout", examples: ["1", "10", "999"] },
  { key: "float", group: "layout", examples: ["left", "right", "none"] },
  { key: "clear", group: "layout", examples: ["both", "left", "right", "none"] },
  { key: "overflow", group: "layout", examples: ["hidden", "auto", "scroll", "visible"] },
  { key: "overflowX", group: "layout", examples: ["hidden", "auto"] },
  { key: "overflowY", group: "layout", examples: ["hidden", "auto"] },
  { key: "visibility", group: "layout", examples: ["visible", "hidden", "collapse"] },

  // Box model
  { key: "width", group: "box", examples: ["100%", "320px"] },
  { key: "height", group: "box", examples: ["100%", "64px"] },
  { key: "minWidth", group: "box", examples: ["0", "200px"] },
  { key: "maxWidth", group: "box", examples: ["100%", "900px"] },
  { key: "minHeight", group: "box", examples: ["0", "48px"] },
  { key: "maxHeight", group: "box", examples: ["100%", "720px"] },
  { key: "margin", group: "box", examples: ["0", "12px"] },
  { key: "marginTop", group: "box", examples: ["8px"] },
  { key: "marginRight", group: "box", examples: ["8px"] },
  { key: "marginBottom", group: "box", examples: ["8px"] },
  { key: "marginLeft", group: "box", examples: ["8px"] },
  { key: "padding", group: "box", examples: ["0", "12px"] },
  { key: "paddingTop", group: "box", examples: ["8px"] },
  { key: "paddingRight", group: "box", examples: ["8px"] },
  { key: "paddingBottom", group: "box", examples: ["8px"] },
  { key: "paddingLeft", group: "box", examples: ["8px"] },
  { key: "border", group: "box", examples: ["1px solid rgba(255,255,255,0.08)"] },
  { key: "borderWidth", group: "box", examples: ["1px"] },
  { key: "borderStyle", group: "box", examples: ["solid", "dashed"] },
  { key: "borderColor", group: "box", examples: ["#ffffff22"] },
  { key: "borderRadius", group: "box", examples: ["12px", "999px"] },
  { key: "boxSizing", group: "box", examples: ["border-box", "content-box"] },

  // Text
  { key: "color", group: "text", examples: ["#d7d8da"] },
  { key: "fontFamily", group: "text", examples: ["Inter, system-ui"] },
  { key: "fontSize", group: "text", examples: ["12px", "14px"] },
  { key: "fontWeight", group: "text", examples: ["400", "600", "bold"] },
  { key: "fontStyle", group: "text", examples: ["normal", "italic"] },
  { key: "lineHeight", group: "text", examples: ["1.2", "18px"] },
  { key: "letterSpacing", group: "text", examples: ["0.02em"] },
  { key: "wordSpacing", group: "text", examples: ["0.1em"] },
  { key: "textAlign", group: "text", examples: ["left", "center", "right"] },
  { key: "textDecoration", group: "text", examples: ["none", "underline"] },
  { key: "textTransform", group: "text", examples: ["uppercase", "capitalize"] },
  { key: "whiteSpace", group: "text", examples: ["nowrap", "pre-wrap"] },
  { key: "textOverflow", group: "text", examples: ["ellipsis"] },

  // Background
  { key: "background", group: "background", examples: ["rgba(255,255,255,0.03)"] },
  { key: "backgroundColor", group: "background", examples: ["#0c0e11"] },
  { key: "backgroundImage", group: "background", examples: ["url(...)"] },
  { key: "backgroundPosition", group: "background", examples: ["center", "0 0"] },
  { key: "backgroundSize", group: "background", examples: ["cover", "contain"] },
  { key: "backgroundRepeat", group: "background", examples: ["no-repeat", "repeat"] },
  { key: "opacity", group: "background", examples: ["1", "0.6"] },

  // Flex
  { key: "flexDirection", group: "flex", examples: ["row", "column"] },
  { key: "flexWrap", group: "flex", examples: ["wrap", "nowrap"] },
  { key: "justifyContent", group: "flex", examples: ["center", "space-between"] },
  { key: "alignItems", group: "flex", examples: ["center", "flex-start"] },
  { key: "alignContent", group: "flex", examples: ["stretch"] },
  { key: "gap", group: "flex", examples: ["8px"] },
  { key: "rowGap", group: "flex", examples: ["8px"] },
  { key: "columnGap", group: "flex", examples: ["8px"] },
  { key: "flexGrow", group: "flex", examples: ["0", "1"] },
  { key: "flexShrink", group: "flex", examples: ["0", "1"] },
  { key: "flexBasis", group: "flex", examples: ["auto", "120px"] },
  { key: "order", group: "flex", examples: ["0", "10"] },
  { key: "alignSelf", group: "flex", examples: ["auto", "stretch"] },

  // Grid
  { key: "gridTemplateColumns", group: "grid", examples: ["repeat(3, 1fr)"] },
  { key: "gridTemplateRows", group: "grid", examples: ["auto 1fr"] },
  { key: "gridArea", group: "grid", examples: ["1 / 1 / 2 / 3"] },
  { key: "gridColumn", group: "grid", examples: ["1 / span 2"] },
  { key: "gridRow", group: "grid", examples: ["2 / 3"] },
  { key: "justifyItems", group: "grid", examples: ["start", "center"] },
  { key: "placeItems", group: "grid", examples: ["center"] },

  // Effects / anim
  { key: "transition", group: "effects", examples: ["all 150ms ease"] },
  { key: "transform", group: "effects", examples: ["translateY(4px)", "scale(1.02)"] },
  { key: "transformOrigin", group: "effects", examples: ["center"] },
  { key: "filter", group: "effects", examples: ["blur(8px)", "brightness(1.1)"] },
  { key: "backdropFilter", group: "effects", examples: ["blur(10px)"] },

  // Misc
  { key: "cursor", group: "misc", examples: ["pointer", "default"] },
  { key: "objectFit", group: "misc", examples: ["cover", "contain"] },
  { key: "objectPosition", group: "misc", examples: ["center"] },
  { key: "scrollBehavior", group: "misc", examples: ["smooth", "auto"] },
];

const KEY_BY_LOWER = new Map(CSS_SUGGESTIONS.map((s) => [s.key.toLowerCase(), s]));

export function findCssSuggestion(key: string) {
  const k = key.trim();
  if (!k) return undefined;
  return KEY_BY_LOWER.get(k.toLowerCase()) ?? KEY_BY_LOWER.get(camelizeKey(k).toLowerCase());
}

export function camelizeKey(key: string) {
  return key
    .trim()
    .replace(/^-+/, "")
    .replace(/-+([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function filterPropertySuggestions(partial: string, limit = 12): string[] {
  const q = partial.trim().toLowerCase();
  if (!q) return CSS_SUGGESTIONS.slice(0, limit).map((s) => s.key);
  const starts: string[] = [];
  const contains: string[] = [];
  for (const s of CSS_SUGGESTIONS) {
    const k = s.key.toLowerCase();
    if (k.startsWith(q)) starts.push(s.key);
    else if (k.includes(q)) contains.push(s.key);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const k of [...starts, ...contains]) {
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= limit) break;
  }
  return out;
}

export function filterValueSuggestions(propertyKey: string, partial: string, limit = 12): string[] {
  const def = findCssSuggestion(propertyKey);
  const key = propertyKey.trim().toLowerCase();
  const pool: string[] = [...(def?.examples ?? [])];

  if (COLOR_PROPERTIES.has(key)) {
    pool.push(...CSS_COLOR_KEYWORDS, ...CSS_HUB_PALETTE);
  }
  if (BORDER_PROPERTIES.has(key)) {
    pool.push("none", "0", "transparent", "1px solid rgba(255,255,255,0.1)", "1px solid #ffffff22");
  }
  if (DISPLAY_PROPERTIES.has(key)) {
    pool.push("flex", "grid", "block", "inline", "inline-flex", "inline-block", "none");
  }
  if (key === "opacity") {
    pool.push("0", "0.5", "0.6", "0.85", "1");
  }
  if (key === "overflow" || key === "overflowx" || key === "overflowy") {
    pool.push("hidden", "auto", "scroll", "visible");
  }
  if (key === "cursor") {
    pool.push("pointer", "default", "grab", "not-allowed");
  }
  if (key === "fontweight") {
    pool.push("400", "500", "600", "700", "bold", "normal");
  }
  if (key === "textalign") {
    pool.push("left", "center", "right", "justify");
  }
  if (key === "justifycontent") {
    pool.push("flex-start", "center", "flex-end", "space-between", "space-around");
  }
  if (key === "alignitems") {
    pool.push("flex-start", "center", "flex-end", "stretch", "baseline");
  }
  if (key === "flexdirection") {
    pool.push("row", "column", "row-reverse", "column-reverse");
  }
  if (key === "gap" || key === "rowgap" || key === "columngap") {
    pool.push("0", "4", "8", "12", "16", "24");
  }
  if (key === "borderradius") {
    pool.push("0", "4", "8", "10", "12", "999px", "50%");
  }
  if (key === "boxshadow" || key === "outline") {
    pool.push("none", "0");
  }
  if (key === "position") {
    pool.push("relative", "absolute", "fixed", "sticky", "static");
  }

  const q = partial.trim().toLowerCase();
  const unique = [...new Set(pool)];

  if (!q) return unique.slice(0, limit);

  const starts: string[] = [];
  const contains: string[] = [];
  for (const v of unique) {
    const vl = v.toLowerCase();
    if (vl.startsWith(q)) starts.push(v);
    else if (vl.includes(q)) contains.push(v);
  }

  // Autocompletar keywords parciales comunes
  if (q === "#" || q.startsWith("#")) {
    for (const hex of CSS_HUB_PALETTE.filter((c) => c.startsWith("#"))) {
      if (hex.toLowerCase().startsWith(q)) starts.push(hex);
    }
  }
  if ("transparent".startsWith(q) && !starts.includes("transparent")) starts.unshift("transparent");
  if ("inherit".startsWith(q) && !starts.includes("inherit")) starts.push("inherit");
  if ("none".startsWith(q) && !starts.includes("none")) starts.unshift("none");

  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of [...starts, ...contains]) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

const COLOR_PROPERTIES = new Set([
  "color",
  "backgroundcolor",
  "background",
  "bordercolor",
  "bordertopcolor",
  "borderbottomcolor",
  "borderleftcolor",
  "borderrightcolor",
  "fill",
  "stroke",
  "outlinecolor",
]);

const BORDER_PROPERTIES = new Set(["border", "borderwidth", "borderstyle", "outline"]);

const DISPLAY_PROPERTIES = new Set(["display"]);

const CSS_COLOR_KEYWORDS = [
  "transparent",
  "inherit",
  "currentColor",
  "black",
  "white",
  "red",
  "green",
  "blue",
  "yellow",
  "orange",
  "purple",
  "pink",
  "gray",
  "grey",
];

/** Paleta habitual del launcher / hub. */
const CSS_HUB_PALETTE = [
  "#0c0e11",
  "#1a1d22",
  "#08090b",
  "#2b2b2b",
  "#ffffff",
  "#e8e9eb",
  "#d7d8da",
  "#8b8d92",
  "#72A53C",
  "#5c9629",
  "#FFC107",
  "#f87171",
  "#7eb8ff",
  "rgba(255,255,255,0.1)",
  "rgba(255,255,255,0.08)",
  "rgba(255,255,255,0.03)",
  "rgba(0,0,0,0.5)",
];

