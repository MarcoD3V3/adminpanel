import type { HubElement } from "../types/hub-layout";
import { coalesceHubInlineStyle, mergeHubElementStyles, normalizeHubCssValue, sanitizeHubCssValue } from "./hub-element-css";

export type HubCssChildSuggestion = {
  token: string;
  label: string;
  type: string;
  refId?: string;
  matchKeys: string[];
};

export type ParsedHubAdvancedCss = {
  ok: true;
  raw: string;
  self: Record<string, string | number>;
  childRules: Record<string, Record<string, string | number>>;
  childPseudo: Record<string, Record<string, Record<string, string | number>>>;
  selfPseudo: Record<string, Record<string, string | number>>;
  warnings: string[];
};

export type ParseHubAdvancedCssResult =
  | ParsedHubAdvancedCss
  | { ok: false; error: string; raw: string; warnings: string[] };

export function slugifyHubCssToken(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeHubCssRefToken(input: string): string {
  return input.trim().replace(/\s+/g, "").replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
}

export function hubElementCssMatchKeys(element: HubElement): string[] {
  const keys = new Set<string>();
  const ref = element.logic?.refId?.trim();
  if (ref) {
    keys.add(ref);
    keys.add(normalizeHubCssRefToken(ref));
  }
  const labelSlug = slugifyHubCssToken(element.label ?? "");
  if (labelSlug) keys.add(labelSlug);
  const hubGroup = element.hubGroup?.trim();
  if (hubGroup) keys.add(slugifyHubCssToken(hubGroup));
  keys.add(element.id);
  keys.add(element.id.slice(0, 8));
  return [...keys].filter(Boolean);
}

export function hubElementMatchesCssToken(element: HubElement, token: string): boolean {
  const t = token.trim().toLowerCase();
  if (!t) return false;
  return hubElementCssMatchKeys(element).some((k) => k.toLowerCase() === t);
}

export function getHubCssChildSuggestions(
  parentId: string,
  elements: HubElement[]
): HubCssChildSuggestion[] {
  return elements
    .filter((el) => el.parentId === parentId)
    .map((child) => {
      const ref = child.logic?.refId?.trim();
      const labelSlug = slugifyHubCssToken(child.label ?? "");
      const token = ref ? normalizeHubCssRefToken(ref) : labelSlug || child.id.slice(0, 8);
      const matchKeys = hubElementCssMatchKeys(child);
      return {
        token,
        label: child.label?.trim() || child.type,
        type: child.type,
        refId: ref || undefined,
        matchKeys,
      };
    });
}

function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Inserta `;` faltantes de forma inteligente antes de parsear/aplicar. */
export function normalizeHubCssSource(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i] ?? "";
    const trimmed = line.trim();

    if (trimmed === "}" || trimmed.startsWith("}")) {
      if (out.length > 0) {
        const prevIdx = out.length - 1;
        const prevTrim = out[prevIdx]!.trim();
        if (
          /^[^:{}]+:\s*.+/.test(prevTrim) &&
          !prevTrim.endsWith(";") &&
          !prevTrim.endsWith("{")
        ) {
          out[prevIdx] = out[prevIdx]!.replace(/\s*$/, ";");
        }
      }
      out.push(line);
      continue;
    }

    if (
      !trimmed ||
      trimmed.startsWith("//") ||
      trimmed.startsWith("/*") ||
      trimmed.endsWith("{") ||
      trimmed === "{"
    ) {
      out.push(line);
      continue;
    }

    if (/^[^:{}]+:\s*.+/.test(trimmed) && !trimmed.endsWith(";")) {
      const nextTrim = (lines[i + 1] ?? "").trim();
      const endsBlock =
        nextTrim === "}" ||
        nextTrim.startsWith("}") ||
        nextTrim.startsWith(".") ||
        nextTrim.startsWith("#") ||
        nextTrim.startsWith("$") ||
        nextTrim.startsWith("@") ||
        nextTrim.startsWith("&") ||
        i === lines.length - 1;
      if (endsBlock) {
        line = line.replace(/\s*$/, ";");
      }
    }

    out.push(line);
  }

  return out.join("\n");
}

/** Errores de sintaxis con número de línea (no aplica cambios al layout). */
export function findHubCssSourceError(raw: string): string | null {
  const lines = raw.split(/\r?\n/);
  let braceDepth = 0;
  let lastOpenLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    const lineNo = i + 1;

    for (const ch of line) {
      if (ch === "{") {
        braceDepth += 1;
        lastOpenLine = lineNo;
      } else if (ch === "}") {
        braceDepth -= 1;
        if (braceDepth < 0) {
          return `Línea ${lineNo}: "}" de más (sin "{" correspondiente)`;
        }
      }
    }

    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;
    if (trimmed === "}" || trimmed.startsWith("}")) continue;
    if (trimmed.endsWith("{") || trimmed === "{") continue;
    if (/^[.#$&@][\w-]+(\s+[.#$&][\w-]+)*\s*\{?\s*$/.test(trimmed)) continue;
    if (/^&:?(hover|active|focus|disabled|focus-visible|focus-within)\s*\{?\s*$/i.test(trimmed)) {
      continue;
    }

    if (!trimmed.includes(":")) {
      return `Línea ${lineNo}: usa el formato propiedad: valor;`;
    }
  }

  if (braceDepth > 0) {
    return `Línea ${lastOpenLine}: bloque sin cerrar (falta "}")`;
  }

  return null;
}

function camelizeCssKey(key: string): string {
  const k = key.trim();
  if (!k) return k;
  if (!k.includes("-")) return k;
  return k.replace(/-([a-zA-Z])/g, (_, c: string) => c.toUpperCase());
}

function parseDeclarationLine(line: string): { key: string; value: string | number } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("//")) return null;
  const m = trimmed.match(/^([^:]+)\s*:\s*(.+)$/);
  if (!m) return null;
  const key = camelizeCssKey(String(m[1] ?? "").trim());
  if (!key) return null;
  let valueRaw = sanitizeHubCssValue(String(m[2] ?? "").trim());
  if (valueRaw === "") return null;
  if (typeof valueRaw === "string" && /^-?\d+(\.\d+)?$/.test(valueRaw)) {
    return { key, value: Number(valueRaw) };
  }
  return { key, value: valueRaw };
}

function mergeDecls(
  base: Record<string, string | number> | undefined,
  add: Record<string, string | number>
): Record<string, string | number> {
  return { ...base, ...add };
}

type SelectorKind =
  | { kind: "self-wrapper" }
  | { kind: "self-pseudo"; pseudo: string }
  | { kind: "child"; token: string }
  | { kind: "child-pseudo"; token: string; pseudo: string }
  | { kind: "unknown"; selector: string };

function parseSelector(selector: string, selfKeys: string[], parentChildToken?: string): SelectorKind {
  const sel = selector.trim();
  if (!sel) return { kind: "unknown", selector: sel };

  if (sel === "&" || sel === ":root") return { kind: "self-wrapper" };

  if (sel.startsWith("&")) {
    const pseudo = sel.slice(1).replace(/^:/, "") || "hover";
    if (parentChildToken) return { kind: "child-pseudo", token: parentChildToken, pseudo };
    return { kind: "self-pseudo", pseudo };
  }

  const prefixed = sel.match(/^[.#$@]([a-zA-Z0-9_-]+)(?:::?([a-zA-Z-]+))?$/);
  if (prefixed) {
    const token = prefixed[1]!.toLowerCase();
    const pseudo = prefixed[2];
    if (pseudo) return { kind: "child-pseudo", token, pseudo };
    if (selfKeys.some((k) => k.toLowerCase() === token)) return { kind: "self-wrapper" };
    return { kind: "child", token };
  }

  const withPseudo = sel.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)(?:::?([a-zA-Z-]+))?$/);
  if (withPseudo) {
    const token = withPseudo[1]!.toLowerCase();
    const pseudo = withPseudo[2];
    if (pseudo) return { kind: "child-pseudo", token, pseudo };
    if (selfKeys.some((k) => k.toLowerCase() === token)) return { kind: "self-wrapper" };
    return { kind: "child", token };
  }

  return { kind: "unknown", selector: sel };
}

function findMatchingBrace(source: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

type ParseCtx = {
  self: Record<string, string | number>;
  childRules: Record<string, Record<string, string | number>>;
  childPseudo: Record<string, Record<string, Record<string, string | number>>>;
  selfPseudo: Record<string, Record<string, string | number>>;
  selfKeys: string[];
  warnings: string[];
};

function parseDeclarationsOnly(source: string): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  const cleaned = normalizeHubCssSource(source.replace(/\}/g, ""));
  for (const part of cleaned.split(";")) {
    const decl = parseDeclarationLine(part);
    if (!decl) continue;
    out[decl.key] = normalizeHubCssValue(decl.key, decl.value);
  }
  return out;
}

function parseChunk(source: string, ctx: ParseCtx, mode: "root" | "self", parentChildToken?: string): void {
  let i = 0;
  while (i < source.length) {
    while (i < source.length && /\s/.test(source[i] ?? "")) i++;
    if (i >= source.length) break;

    const braceIdx = source.indexOf("{", i);
    const colonIdx = source.indexOf(":", i);
    const semiIdx = source.indexOf(";", i);

    const isBlock =
      braceIdx !== -1 &&
      (colonIdx === -1 || braceIdx < colonIdx) &&
      (semiIdx === -1 || braceIdx < semiIdx);

    if (isBlock) {
      const selector = source.slice(i, braceIdx).trim();
      const closeIdx = findMatchingBrace(source, braceIdx);
      if (closeIdx === -1) {
        ctx.warnings.push(`Bloque sin cerrar: "${selector}"`);
        break;
      }
      const body = source.slice(braceIdx + 1, closeIdx);
      i = closeIdx + 1;

      const parsed = parseSelector(selector, ctx.selfKeys, parentChildToken);
      if (parsed.kind === "self-wrapper" || (parsed.kind === "unknown" && mode === "root")) {
        parseChunk(body, ctx, "self");
        continue;
      }
      if (parsed.kind === "self-pseudo") {
        ctx.selfPseudo[parsed.pseudo] = mergeDecls(ctx.selfPseudo[parsed.pseudo], parseDeclarationsOnly(body));
        parseNestedChildBlocks(body, ctx, undefined);
        continue;
      }
      if (parsed.kind === "child") {
        ctx.childRules[parsed.token] = mergeDecls(ctx.childRules[parsed.token], parseDeclarationsOnly(body));
        parseNestedChildBlocks(body, ctx, parsed.token);
        continue;
      }
      if (parsed.kind === "child-pseudo") {
        const bucket = ctx.childPseudo[parsed.token] ?? {};
        bucket[parsed.pseudo] = mergeDecls(bucket[parsed.pseudo], parseDeclarationsOnly(body));
        ctx.childPseudo[parsed.token] = bucket;
        continue;
      }
      ctx.warnings.push(`Selector no reconocido: "${selector}"`);
      continue;
    }

    const end = semiIdx === -1 ? source.length : semiIdx + 1;
    const line = source.slice(i, end).trim();
    if (line) {
      const decl = parseDeclarationLine(line);
      if (decl) {
        const normalized = normalizeHubCssValue(decl.key, decl.value);
        if (mode === "self" || mode === "root") {
          ctx.self[decl.key] = normalized;
        } else if (parentChildToken) {
          ctx.childRules[parentChildToken] = mergeDecls(ctx.childRules[parentChildToken], {
            [decl.key]: normalized,
          });
        }
      }
    }
    i = end;
  }
}

function parseNestedChildBlocks(body: string, ctx: ParseCtx, parentChildToken?: string): void {
  let i = 0;
  while (i < body.length) {
    const braceIdx = body.indexOf("{", i);
    if (braceIdx === -1) break;
    const colonBefore = body.indexOf(":", i);
    if (colonBefore !== -1 && colonBefore < braceIdx) {
      const semi = body.indexOf(";", i);
      const declEnd = semi === -1 ? braceIdx : semi;
      const line = body.slice(i, declEnd).trim();
      const decl = parseDeclarationLine(line);
      if (decl && parentChildToken) {
        ctx.childRules[parentChildToken] = mergeDecls(ctx.childRules[parentChildToken], {
          [decl.key]: normalizeHubCssValue(decl.key, decl.value),
        });
      }
      i = semi === -1 ? braceIdx : semi + 1;
      continue;
    }
    const selector = body.slice(i, braceIdx).trim();
    const closeIdx = findMatchingBrace(body, braceIdx);
    if (closeIdx === -1) break;
    const blockBody = body.slice(braceIdx + 1, closeIdx);
    i = closeIdx + 1;

    const parsed = parseSelector(selector, ctx.selfKeys, parentChildToken);
    if (parsed.kind === "child-pseudo") {
      const bucket = ctx.childPseudo[parsed.token] ?? {};
      bucket[parsed.pseudo] = mergeDecls(bucket[parsed.pseudo], parseDeclarationsOnly(blockBody));
      ctx.childPseudo[parsed.token] = bucket;
    } else if (parsed.kind === "child") {
      ctx.childRules[parsed.token] = mergeDecls(ctx.childRules[parsed.token], parseDeclarationsOnly(blockBody));
      parseNestedChildBlocks(blockBody, ctx, parsed.token);
    } else if (parsed.kind === "self-pseudo" && parentChildToken) {
      const bucket = ctx.childPseudo[parentChildToken] ?? {};
      bucket[parsed.pseudo] = mergeDecls(bucket[parsed.pseudo], parseDeclarationsOnly(blockBody));
      ctx.childPseudo[parentChildToken] = bucket;
    }
  }
}

function coalesceSelfCss(self: Record<string, string | number>): Record<string, string | number> {
  return coalesceHubInlineStyle(self);
}

function coalesceChildRules(
  rules: Record<string, Record<string, string | number>>
): Record<string, Record<string, string | number>> {
  const out: Record<string, Record<string, string | number>> = {};
  for (const [token, decls] of Object.entries(rules)) {
    out[token] = coalesceHubInlineStyle(decls);
  }
  return out;
}

/** Parsea CSS avanzado (plano + bloques anidados para hijos). */
export function parseHubAdvancedCss(
  raw: string,
  options?: { selfMatchKeys?: string[] }
): ParseHubAdvancedCssResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      ok: true,
      raw: "",
      self: {},
      childRules: {},
      childPseudo: {},
      selfPseudo: {},
      warnings: [],
    };
  }

  const ctx: ParseCtx = {
    self: {},
    childRules: {},
    childPseudo: {},
    selfPseudo: {},
    selfKeys: options?.selfMatchKeys ?? [],
    warnings: [],
  };

  try {
    const syntaxError = findHubCssSourceError(trimmed);
    if (syntaxError) {
      return {
        ok: false,
        error: syntaxError,
        raw: trimmed,
        warnings: ctx.warnings,
      };
    }
    const normalized = normalizeHubCssSource(trimmed);
    parseChunk(stripCssComments(normalized), ctx, "root");
    return {
      ok: true,
      raw: normalized,
      self: coalesceSelfCss(ctx.self),
      childRules: coalesceChildRules(ctx.childRules),
      childPseudo: ctx.childPseudo,
      selfPseudo: ctx.selfPseudo,
      warnings: ctx.warnings,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error al parsear CSS",
      raw: trimmed,
      warnings: ctx.warnings,
    };
  }
}

function findChildByToken(
  parentId: string,
  token: string,
  elements: HubElement[]
): HubElement | undefined {
  return elements.find((el) => el.parentId === parentId && hubElementMatchesCssToken(el, token));
}

/** Reglas del padre que aplican a un hijo (solo propiedades que el hijo no define). */
export function resolveParentCssForChild(
  element: HubElement,
  allElements: HubElement[]
): Record<string, string | number> {
  const chain: HubElement[] = [];
  let current: HubElement | undefined = element;
  while (current?.parentId) {
    const parent = allElements.find((e) => e.id === current!.parentId);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }

  const ownKeys = new Set(Object.keys(element.css ?? {}));
  const inherited: Record<string, string | number> = {};

  for (const parent of chain) {
    const rules = parent.cssChildRules;
    if (!rules) continue;
    for (const [token, decls] of Object.entries(rules)) {
      if (!hubElementMatchesCssToken(element, token)) continue;
      for (const [key, value] of Object.entries(decls)) {
        if (ownKeys.has(key)) continue;
        inherited[key] = value;
      }
    }
  }

  return inherited;
}

/** CSS efectivo del elemento: reglas heredadas del padre + css propio (el propio gana). */
export function resolveEffectiveHubCss(
  element: HubElement,
  allElements: HubElement[]
): Record<string, string | number> {
  return mergeHubElementStyles(resolveParentCssForChild(element, allElements), element.css);
}

function declsToCssText(decls: Record<string, string | number>): string {
  return Object.entries(decls)
    .map(([k, v]) => {
      const kebab = k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      return `${kebab}:${String(v)}`;
    })
    .join(";");
}

/** Hoja de estilos para pseudos (:hover, etc.) que inline no puede cubrir. */
export function compileHubAdvancedCssSheet(elements: HubElement[]): string {
  const lines: string[] = [];

  for (const el of elements) {
    if (el.cssSelfPseudo) {
      for (const [pseudo, decls] of Object.entries(el.cssSelfPseudo)) {
        const body = declsToCssText(decls);
        if (!body) continue;
        lines.push(`[data-hub-el="${el.id}"]:${pseudo}{${body}}`);
      }
    }
  }

  for (const parent of elements) {
    if (!parent.cssChildPseudo) continue;
    for (const [token, pseudos] of Object.entries(parent.cssChildPseudo)) {
      const child = findChildByToken(parent.id, token, elements);
      if (!child) continue;
      for (const [pseudo, decls] of Object.entries(pseudos)) {
        const body = declsToCssText(decls);
        if (!body) continue;
        lines.push(`[data-hub-el="${child.id}"]:${pseudo}{${body}}`);
      }
    }
  }

  return lines.join("\n");
}

export function serializeHubCssRaw(element: HubElement): string {
  if (element.cssRaw?.trim()) return element.cssRaw;
  const lines = Object.entries(element.css ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}: ${String(v)};`);
  return lines.join("\n");
}

export function buildHubCssChildSnippet(suggestion: HubCssChildSuggestion): string {
  return `.${suggestion.token} {\n  \n}`;
}

export const HUB_CSS_SNIPPETS = [
  { label: "Flex columna", insert: "display: flex;\nflexDirection: column;\ngap: 12;" },
  { label: "Centrar", insert: "display: flex;\nalignItems: center;\njustifyContent: center;" },
  { label: "Sin borde", insert: "border: none;" },
  { label: "Bloque hijo", insert: ".hijo {\n  display: block;\n}" },
  { label: "Hover hijo", insert: ".hijo {\n  &:hover {\n    opacity: 0.85;\n  }\n}" },
] as const;
