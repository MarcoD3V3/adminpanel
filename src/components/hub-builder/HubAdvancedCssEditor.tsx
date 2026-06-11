"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  camelizeKey,
  filterPropertySuggestions,
  filterValueSuggestions,
  findCssSuggestion,
} from "@/lib/css-suggestions";
import { CSS_TOKEN_COLORS, parseErrorLine, tokenizeCssLine } from "@/lib/css-highlight";
import type { HubCssChildSuggestion, ParsedHubAdvancedCss } from "@craftlauncher/shared";
import {
  buildHubCssChildSnippet,
  HUB_CSS_SNIPPETS,
  parseHubAdvancedCss,
} from "@craftlauncher/shared";

const EDITOR_LINE = "leading-[1.65rem]";
const EDITOR_FONT = cn("font-mono text-[12px] tab-size-2", EDITOR_LINE);
const EDITOR_PAD = "px-3 py-2";
const EDITOR_LINE_HEIGHT_PX = 26.4;
const AC_MAX_ITEMS = 7;

type AcMode = "property" | "value" | "selector";

type CaretCoords = {
  top: number;
  left: number;
  bottom: number;
  lineHeight: number;
};

type AcAnchor = {
  top: number;
  left: number;
  placement: "below" | "above";
};

function expandTabsForMeasure(text: string, tabSize = 2): string {
  return text.replace(/\t/g, " ".repeat(tabSize));
}

function measureMonoCharWidth(textarea: HTMLTextAreaElement): number {
  const style = window.getComputedStyle(textarea);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return 7.2;
  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return ctx.measureText("m").width;
}

function getCaretPixelPosition(textarea: HTMLTextAreaElement, caret: number): CaretCoords {
  const style = window.getComputedStyle(textarea);
  const lineHeight = parseFloat(style.lineHeight) || EDITOR_LINE_HEIGHT_PX;
  const padTop = parseFloat(style.paddingTop) || 8;
  const padLeft = parseFloat(style.paddingLeft) || 12;
  const tabSize = parseInt(style.tabSize || "2", 10) || 2;
  const charWidth = measureMonoCharWidth(textarea);

  const before = expandTabsForMeasure(textarea.value.slice(0, caret), tabSize);
  const lineParts = before.split("\n");
  const lineIndex = lineParts.length - 1;
  const col = lineParts[lineIndex]?.length ?? 0;

  const top = padTop + lineIndex * lineHeight - textarea.scrollTop;
  const left = padLeft + col * charWidth - textarea.scrollLeft;

  return { top, left, bottom: top + lineHeight, lineHeight };
}

function computeAcAnchor(
  textarea: HTMLTextAreaElement,
  caret: number,
  itemCount: number
): AcAnchor | null {
  if (!textarea || itemCount <= 0) return null;
  const rect = textarea.getBoundingClientRect();
  const caretPx = getCaretPixelPosition(textarea, caret);
  const rowH = 26;
  const headerH = 22;
  const popupH = Math.min(itemCount * rowH + headerH, 168);
  const popupW = Math.min(220, Math.max(140, rect.width * 0.55));
  const gap = 4;

  let top = rect.top + caretPx.bottom + gap;
  let placement: "below" | "above" = "below";

  if (top + popupH > window.innerHeight - 8) {
    top = rect.top + caretPx.top - popupH - gap;
    placement = "above";
  }

  let left = rect.left + caretPx.left;
  if (left + popupW > window.innerWidth - 8) {
    left = window.innerWidth - popupW - 8;
  }
  if (left < 8) left = 8;

  return { top, left, placement };
}

function lineDeclarationComplete(line: string): boolean {
  return /^[^:{}]+:\s*.+;\s*$/.test(line.trim());
}

const CSS_INDENT = "  ";

function getLineIndent(line: string): string {
  return line.match(/^(\s*)/)?.[1] ?? "";
}

/** Sangría del contenido dentro del bloque `{` más cercano antes del cursor. */
function getBlockContentIndent(raw: string, caret: number): string {
  const before = raw.slice(0, caret);
  let depth = 0;
  for (let i = before.length - 1; i >= 0; i--) {
    const ch = before[i];
    if (ch === "}") depth++;
    else if (ch === "{") {
      if (depth === 0) {
        const lineStart = before.lastIndexOf("\n", i) + 1;
        return getLineIndent(before.slice(lineStart, i)) + CSS_INDENT;
      }
      depth--;
    }
  }
  const lineStart = before.lastIndexOf("\n") + 1;
  return getLineIndent(before.slice(lineStart));
}

function computeSmartNewlineIndent(raw: string, caret: number): string {
  const lineStart = raw.lastIndexOf("\n", Math.max(0, caret - 1)) + 1;
  const lineEnd = raw.indexOf("\n", caret);
  const lineEndActual = lineEnd === -1 ? raw.length : lineEnd;
  const currentLine = raw.slice(lineStart, lineEndActual);
  const afterOnLine = raw.slice(caret, lineEndActual);
  const trimmed = currentLine.trim();
  const lineIndent = getLineIndent(currentLine);
  const blockIndent = getBlockContentIndent(raw, caret);

  if (trimmed.endsWith("{")) {
    return lineIndent + CSS_INDENT;
  }

  if (blockIndent) {
    if (trimmed === "" || trimmed.endsWith(";")) {
      return blockIndent;
    }
    if (afterOnLine.trim().startsWith("}")) {
      return blockIndent;
    }
  }

  return lineIndent;
}

/** Backspace inteligente: en líneas vacías con sangría, salta al borde; espacios extra se borran de a uno. */
function computeSmartBackspace(raw: string, caret: number): { from: number; to: number } | null {
  if (caret <= 0) return null;

  const lineStart = raw.lastIndexOf("\n", caret - 1) + 1;
  const lineEnd = raw.indexOf("\n", caret);
  const lineEndActual = lineEnd === -1 ? raw.length : lineEnd;
  const currentLine = raw.slice(lineStart, lineEndActual);
  const beforeOnLine = raw.slice(lineStart, caret);
  const afterOnLine = raw.slice(caret, lineEndActual);

  if (!beforeOnLine || !/^\s+$/.test(beforeOnLine)) return null;

  const indentLen = beforeOnLine.length;
  const trimmedLine = currentLine.trim();

  if (trimmedLine === "") {
    const blockIndentLen = getBlockContentIndent(raw, caret).length;
    if (blockIndentLen > 0 && indentLen <= blockIndentLen) {
      return { from: lineStart, to: caret };
    }
    if (indentLen > blockIndentLen && blockIndentLen > 0) {
      return { from: caret - 1, to: caret };
    }
    if (indentLen > 0 && indentLen <= CSS_INDENT.length) {
      return { from: lineStart, to: caret };
    }
    if (indentLen > CSS_INDENT.length) {
      const snap = indentLen - (indentLen % CSS_INDENT.length || CSS_INDENT.length);
      return { from: lineStart + snap, to: caret };
    }
    return { from: lineStart, to: caret };
  }

  if (afterOnLine.trim().length > 0) {
    const deleteCount = indentLen >= CSS_INDENT.length ? CSS_INDENT.length : indentLen;
    return { from: caret - deleteCount, to: caret };
  }

  return null;
}

type CaretCtx = {
  lineIndex: number;
  lineStart: number;
  lineEnd: number;
  lineText: string;
  mode: AcMode;
  propertyKey: string;
  partial: string;
};

function getCaretContext(raw: string, caret: number): CaretCtx {
  const safeCaret = Math.max(0, Math.min(caret, raw.length));
  const lineStart = raw.lastIndexOf("\n", safeCaret - 1) + 1;
  let lineEnd = raw.indexOf("\n", safeCaret);
  if (lineEnd === -1) lineEnd = raw.length;
  const lineText = raw.slice(lineStart, lineEnd);
  const beforeCaret = raw.slice(lineStart, safeCaret);

  if (lineText.trim().startsWith("/*") || lineText.trim().startsWith("//")) {
    return {
      lineIndex: raw.slice(0, lineStart).split("\n").length - 1,
      lineStart,
      lineEnd,
      lineText,
      mode: "property",
      propertyKey: "",
      partial: "",
    };
  }

  const selectorMatch = beforeCaret.match(/(?:^|[\s{])([.#$@][a-zA-Z0-9_-]*)$/);
  if (selectorMatch && !beforeCaret.includes(":")) {
    return {
      lineIndex: raw.slice(0, lineStart).split("\n").length - 1,
      lineStart,
      lineEnd,
      lineText,
      mode: "selector",
      propertyKey: "",
      partial: selectorMatch[1] ?? "",
    };
  }

  const colonIdx = beforeCaret.indexOf(":");
  if (colonIdx >= 0) {
    const propPart = beforeCaret.slice(0, colonIdx).trim();
    const propKey = camelizeKey(propPart.split(/\s+/).pop() ?? propPart);
    return {
      lineIndex: raw.slice(0, lineStart).split("\n").length - 1,
      lineStart,
      lineEnd,
      lineText,
      mode: "value",
      propertyKey: propKey,
      partial: beforeCaret
        .slice(colonIdx + 1)
        .trim()
        .replace(/;[\s\S]*$/, ""),
    };
  }

  const propMatch = beforeCaret.match(/(?:^|\s)([a-zA-Z-]*)$/);
  return {
    lineIndex: raw.slice(0, lineStart).split("\n").length - 1,
    lineStart,
    lineEnd,
    lineText,
    mode: "property",
    propertyKey: "",
    partial: propMatch?.[1] ?? beforeCaret.trim(),
  };
}

function HighlightedCss({ source }: { source: string }) {
  const lines = useMemo(() => source.split("\n"), [source]);
  return (
    <>
      {lines.map((line, i) => {
        const tokens = tokenizeCssLine(line);
        return (
          <div key={i} className={cn("whitespace-pre", EDITOR_LINE)}>
            {tokens.map((t, j) => (
              <span key={j} style={{ color: CSS_TOKEN_COLORS[t.kind] }}>
                {t.text}
              </span>
            ))}
          </div>
        );
      })}
    </>
  );
}

type CssEditorPaneProps = {
  raw: string;
  tall?: boolean;
  error: string | null;
  warnings: string[];
  displayLineCount: number;
  lines: string[];
  placeholder: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  preRef: React.RefObject<HTMLPreElement | null>;
  gutterRef: React.RefObject<HTMLDivElement | null>;
  acOpen: boolean;
  acItems: string[];
  acIndex: number;
  acMode: AcMode;
  acAnchor: AcAnchor | null;
  caretCtx: CaretCtx;
  onChange: (next: string, pos: number | null) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSelect: (pos: number) => void;
  onScroll: () => void;
  onBlur: () => void;
  onPickAc: (item: string) => void;
};

function CssAutocompletePopup({
  acOpen,
  acItems,
  acIndex,
  acMode,
  acAnchor,
  caretCtx,
  onPickAc,
}: {
  acOpen: boolean;
  acItems: string[];
  acIndex: number;
  acMode: AcMode;
  acAnchor: AcAnchor | null;
  caretCtx: CaretCtx;
  onPickAc: (item: string) => void;
}) {
  if (!acOpen || acItems.length === 0 || !acAnchor || typeof document === "undefined") return null;

  const label =
    acMode === "property"
      ? "Propiedades"
      : acMode === "selector"
        ? "Hijos"
        : `Valores · ${caretCtx.propertyKey || "…"}`;

  return createPortal(
    <div
      className="fixed z-[300] overflow-hidden rounded-md border border-[var(--color-border-subtle)]/80 bg-[#0c0e12]/95 py-0.5 shadow-xl backdrop-blur-sm"
      style={{
        top: acAnchor.top,
        left: acAnchor.left,
        width: "min(220px, calc(100vw - 16px))",
        maxHeight: 168,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)]/50 px-2 py-0.5">
        <span className="text-[8px] uppercase tracking-wide text-[var(--color-muted)]">{label}</span>
        <span className="text-[8px] text-[var(--color-muted)]/70">
          {acAnchor.placement === "above" ? "↑" : "↓"} Tab
        </span>
      </div>
      <div className="max-h-[140px] overflow-y-auto">
        {acItems.map((item, i) => (
          <button
            key={`${item}-${i}`}
            type="button"
            className={cn(
              "flex w-full px-2 py-1 text-left font-mono text-[10px] leading-tight",
              i === acIndex
                ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "text-[var(--color-text-soft)] hover:bg-[var(--color-surface-hover)]/80"
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              onPickAc(item);
            }}
          >
            {item}
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}

function CssEditorPane({
  raw,
  tall,
  error,
  warnings,
  displayLineCount,
  lines,
  placeholder,
  textareaRef,
  preRef,
  gutterRef,
  acOpen,
  acItems,
  acIndex,
  acMode,
  acAnchor,
  caretCtx,
  onChange,
  onKeyDown,
  onSelect,
  onScroll,
  onBlur,
  onPickAc,
}: CssEditorPaneProps) {
  const errorLine = parseErrorLine(error);

  return (
    <>
      <CssAutocompletePopup
        acOpen={acOpen}
        acItems={acItems}
        acIndex={acIndex}
        acMode={acMode}
        acAnchor={acAnchor}
        caretCtx={caretCtx}
        onPickAc={onPickAc}
      />
      <div
      className={cn(
        "overflow-hidden rounded-lg border bg-[#0a0c0f]",
        error ? "border-[#f87171]/40" : "border-[var(--color-border-subtle)]"
      )}
    >
      <div className={cn("flex", tall ? "min-h-[min(62vh,520px)] max-h-[62vh]" : "max-h-[240px] min-h-[160px]")}>
        <div
          ref={gutterRef}
          className={cn(
            "shrink-0 select-none overflow-hidden border-r border-[var(--color-border-subtle)] bg-[#08090b] py-2 pl-2 pr-2.5 text-right",
            EDITOR_FONT
          )}
          aria-hidden
        >
          {Array.from({ length: displayLineCount }, (_, i) => {
            const n = i + 1;
            return (
              <div
                key={i}
                className={cn(
                  EDITOR_LINE,
                  i >= lines.length && "opacity-30",
                  errorLine === n ? "text-[#f87171]" : "text-[var(--color-muted)]"
                )}
              >
                {n}
              </div>
            );
          })}
        </div>

        <div className={cn("relative min-w-0 flex-1", tall ? "min-h-[min(62vh,520px)]" : "min-h-[160px]")}>
          <pre
            ref={preRef}
            aria-hidden
            className={cn("pointer-events-none absolute inset-0 m-0 overflow-hidden", EDITOR_PAD, EDITOR_FONT)}
          >
            <HighlightedCss source={raw} />
          </pre>

          <textarea
            ref={textareaRef}
            value={raw}
            onChange={(e) => onChange(e.target.value, e.target.selectionStart)}
            onKeyDown={onKeyDown}
            onSelect={(e) => onSelect(e.currentTarget.selectionStart ?? 0)}
            onClick={(e) => onSelect(e.currentTarget.selectionStart ?? 0)}
            onScroll={onScroll}
            onBlur={onBlur}
            wrap="off"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            data-gramm="false"
            placeholder={placeholder}
            className={cn(
              "relative z-[1] block h-full w-full resize-none overflow-auto bg-transparent",
              EDITOR_PAD,
              EDITOR_FONT,
              "whitespace-pre text-transparent caret-[var(--color-accent)]",
              "outline-none placeholder:text-[var(--color-muted)]/35"
            )}
            style={{ tabSize: 2 }}
          />
        </div>
      </div>

      {!error && warnings.length > 0 && (
        <div className="border-t border-[#fbbf24]/20 px-2.5 py-1.5 font-mono text-[9px] text-[#fbbf24]">
          {warnings.join(" · ")}
        </div>
      )}
      </div>
    </>
  );
}

export type HubAdvancedCssEditorProps = {
  cssRaw: string;
  selfMatchKeys?: string[];
  childSuggestions?: HubCssChildSuggestion[];
  elementLabel?: string;
  onApply: (result: ParsedHubAdvancedCss) => void;
};

export function HubAdvancedCssEditor({
  cssRaw,
  selfMatchKeys = [],
  childSuggestions = [],
  elementLabel,
  onApply,
}: HubAdvancedCssEditorProps) {
  const [raw, setRaw] = useState(cssRaw);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const expandedTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const expandedPreRef = useRef<HTMLPreElement>(null);
  const expandedGutterRef = useRef<HTMLDivElement>(null);
  const isFocusedRef = useRef(false);
  const lastAppliedRawRef = useRef(cssRaw);
  const rawRef = useRef(cssRaw);
  const applyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [caret, setCaret] = useState(0);
  const [acOpen, setAcOpen] = useState(false);
  const [acIndex, setAcIndex] = useState(0);
  const [acItems, setAcItems] = useState<string[]>([]);
  const [acMode, setAcMode] = useState<AcMode>("property");
  const [acAnchor, setAcAnchor] = useState<AcAnchor | null>(null);
  const forceAcRef = useRef(false);

  const lines = useMemo(() => raw.split("\n"), [raw]);
  const displayLineCount = Math.max(expanded ? 24 : 8, lines.length);

  const placeholder = useMemo(
    () =>
      [
        "/* CSS del elemento + estilos para hijos */",
        "display: flex;",
        "gap: 12;",
        "",
        ".titulo {",
        "  color: #72A53C;",
        "  fontSize: 40;",
        "}",
      ].join("\n"),
    []
  );

  useEffect(() => {
    if (isFocusedRef.current) return;
    if (cssRaw === lastAppliedRawRef.current) return;
    setRaw(cssRaw);
    setError(null);
    setWarnings([]);
    lastAppliedRawRef.current = cssRaw;
  }, [cssRaw]);

  const syncScroll = useCallback(
    (ta: HTMLTextAreaElement | null, pre: HTMLPreElement | null, gutter: HTMLDivElement | null) => {
      if (!ta) return;
      if (pre) {
        pre.scrollTop = ta.scrollTop;
        pre.scrollLeft = ta.scrollLeft;
      }
      if (gutter) gutter.scrollTop = ta.scrollTop;
    },
    []
  );

  const selectorSuggestions = useMemo(() => {
    const items: string[] = [];
    for (const child of childSuggestions) {
      items.push(`.${child.token}`);
      if (child.refId) items.push(`$${child.refId}`);
      items.push(`#${child.token}`);
    }
    items.push("&:hover", "&:active", "&:focus");
    return [...new Set(items)];
  }, [childSuggestions]);

  const updateAcAnchor = useCallback(
    (textarea: HTMLTextAreaElement | null, caretPos: number, itemCount: number) => {
      if (!textarea || itemCount <= 0) {
        setAcAnchor(null);
        return;
      }
      setAcAnchor(computeAcAnchor(textarea, caretPos, itemCount));
    },
    []
  );

  const refreshAutocomplete = useCallback(
    (text: string, caretPos: number, textarea?: HTMLTextAreaElement | null, force = false) => {
      const ctx = getCaretContext(text, caretPos);
      const trimmedLine = ctx.lineText.trim();

      if (trimmedLine.startsWith("//") || trimmedLine.startsWith("/*")) {
        setAcOpen(false);
        setAcAnchor(null);
        return;
      }

      if (
        !force &&
        ctx.mode === "value" &&
        lineDeclarationComplete(ctx.lineText) &&
        caretPos >= ctx.lineEnd - 1
      ) {
        setAcOpen(false);
        setAcAnchor(null);
        return;
      }

      if (ctx.mode === "selector" && ctx.partial.length < 1 && !force) {
        setAcOpen(false);
        setAcAnchor(null);
        return;
      }

      let items: string[] = [];
      if (ctx.mode === "selector") {
        items = selectorSuggestions
          .filter((s) => s.toLowerCase().includes(ctx.partial.toLowerCase()))
          .slice(0, AC_MAX_ITEMS);
        setAcMode("selector");
      } else if (ctx.mode === "property") {
        if (!force && ctx.partial.length < 1) {
          setAcOpen(false);
          setAcAnchor(null);
          return;
        }
        items = filterPropertySuggestions(ctx.partial, AC_MAX_ITEMS);
        setAcMode("property");
      } else {
        items = filterValueSuggestions(ctx.propertyKey, ctx.partial, AC_MAX_ITEMS);
        setAcMode("value");
        // Mostrar valores al escribir solo ":" (partial vacío)
        if (!force && items.length === 0 && ctx.partial.length < 1) {
          setAcOpen(false);
          setAcAnchor(null);
          return;
        }
      }

      if (items.length === 0) {
        setAcOpen(false);
        setAcAnchor(null);
        return;
      }

      setAcItems(items);
      setAcOpen(true);
      setAcIndex(0);
      const ta =
        textarea ?? (expanded ? expandedTextareaRef.current : textareaRef.current);
      updateAcAnchor(ta, caretPos, items.length);
    },
    [expanded, selectorSuggestions, updateAcAnchor]
  );

  const applyRaw = useCallback(
    (nextRaw: string) => {
      const parsed = parseHubAdvancedCss(nextRaw, { selfMatchKeys });
      if (!parsed.ok) {
        setError(parsed.error);
        setWarnings(parsed.warnings);
        return false;
      }
      setError(null);
      setWarnings(parsed.warnings);
      lastAppliedRawRef.current = parsed.raw;
      if (parsed.raw !== nextRaw) {
        setRaw(parsed.raw);
      }
      onApply(parsed);
      return true;
    },
    [onApply, selfMatchKeys]
  );

  const flushApply = useCallback(() => {
    if (applyTimerRef.current) {
      clearTimeout(applyTimerRef.current);
      applyTimerRef.current = null;
    }
    applyRaw(rawRef.current);
  }, [applyRaw]);

  rawRef.current = raw;

  useEffect(() => {
    if (raw === lastAppliedRawRef.current) return;
    if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
    applyTimerRef.current = setTimeout(() => {
      applyTimerRef.current = null;
      applyRaw(raw);
    }, 200);
    return () => {
      if (applyTimerRef.current) {
        clearTimeout(applyTimerRef.current);
        applyTimerRef.current = null;
      }
    };
  }, [raw, applyRaw]);

  useEffect(
    () => () => {
      if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        flushApply();
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, flushApply]);

  const insertCompletion = useCallback(
    (item: string) => {
      const el = expanded ? expandedTextareaRef.current : textareaRef.current;
      if (!el) return;
      const text = raw;
      const pos = el.selectionStart ?? caret;
      const ctx = getCaretContext(text, pos);

      let newText: string;
      let newCaret: number;

      if (ctx.mode === "selector") {
        const tokenLen = ctx.partial.length;
        const tokenStart = Math.max(ctx.lineStart, pos - tokenLen);
        const needsBrace = !item.includes("{");
        newText = text.slice(0, tokenStart) + item + (needsBrace ? " {\n  \n}" : "") + text.slice(pos);
        newCaret = tokenStart + item.length + (needsBrace ? 4 : 0);
      } else if (ctx.mode === "property") {
        const completedKey = findCssSuggestion(item)?.key ?? item;
        const tokenLen = ctx.partial.length;
        const tokenStart = Math.max(ctx.lineStart, pos - tokenLen);
        newText = text.slice(0, tokenStart) + completedKey + ": " + text.slice(pos);
        newCaret = tokenStart + completedKey.length + 2;
      } else {
        // Modo valor: reemplazar todo el token parcial (transp → transparent)
        const lineBefore = text.slice(ctx.lineStart, pos);
        const colonRel = lineBefore.indexOf(":");
        let valueStart = ctx.lineStart + colonRel + 1;
        while (valueStart < text.length && /\s/.test(text[valueStart] ?? "")) valueStart += 1;

        const replaceEnd = Math.max(pos, valueStart + ctx.partial.length);
        const tail = text.slice(replaceEnd).replace(/^;?\s*/, "");
        const suffix = tail ? `; ${tail}` : ";";
        newText = text.slice(0, valueStart) + item + suffix;
        newCaret = valueStart + item.length + 1;
      }

      setRaw(newText);
      setAcOpen(false);
      queueMicrotask(() => {
        el.focus();
        el.setSelectionRange(newCaret, newCaret);
        setCaret(newCaret);
        refreshAutocomplete(newText, newCaret, el);
      });
    },
    [caret, expanded, raw, refreshAutocomplete]
  );

  const handleChange = (next: string, selectionStart: number | null, textarea?: HTMLTextAreaElement | null) => {
    setRaw(next);
    const pos = selectionStart ?? next.length;
    setCaret(pos);
    refreshAutocomplete(next, pos, textarea);
  };

  const handleScrollWithAc = (textarea: HTMLTextAreaElement | null) => {
    if (acOpen && acItems.length > 0 && textarea) {
      updateAcAnchor(textarea, caret, acItems.length);
    }
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    window.setTimeout(() => {
      setAcOpen(false);
      setAcAnchor(null);
      flushApply();
    }, 120);
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === " " && e.ctrlKey) {
      e.preventDefault();
      forceAcRef.current = true;
      refreshAutocomplete(raw, e.currentTarget.selectionStart ?? caret, e.currentTarget, true);
      forceAcRef.current = false;
      return;
    }

    if (e.key === "Backspace") {
      const el = e.currentTarget;
      const selStart = el.selectionStart ?? 0;
      const selEnd = el.selectionEnd ?? 0;
      if (selStart === selEnd) {
        const smart = computeSmartBackspace(raw, selStart);
        if (smart) {
          e.preventDefault();
          setAcOpen(false);
          setAcAnchor(null);
          const newText = raw.slice(0, smart.from) + raw.slice(smart.to);
          const newCaret = smart.from;
          setRaw(newText);
          setCaret(newCaret);
          queueMicrotask(() => {
            el.focus();
            el.setSelectionRange(newCaret, newCaret);
            refreshAutocomplete(newText, newCaret, el);
          });
          return;
        }
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      setAcOpen(false);
      setAcAnchor(null);
      const el = e.currentTarget;
      const pos = el.selectionStart ?? caret;
      const indent = computeSmartNewlineIndent(raw, pos);
      const insert = `\n${indent}`;
      const newText = raw.slice(0, pos) + insert + raw.slice(pos);
      const newCaret = pos + insert.length;
      setRaw(newText);
      setCaret(newCaret);
      queueMicrotask(() => {
        el.focus();
        el.setSelectionRange(newCaret, newCaret);
        refreshAutocomplete(newText, newCaret, el);
      });
      return;
    }

    if (!acOpen || acItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAcIndex((i) => (i + 1) % acItems.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setAcIndex((i) => (i - 1 + acItems.length) % acItems.length);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setAcOpen(false);
      setAcAnchor(null);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const item = acItems[acIndex];
      if (item) insertCompletion(item);
    }
  };

  const caretCtx = getCaretContext(raw, caret);

  const sharedPaneProps: Omit<
    CssEditorPaneProps,
    "textareaRef" | "preRef" | "gutterRef" | "tall" | "onScroll"
  > = {
    raw,
    error,
    warnings,
    displayLineCount,
    lines,
    placeholder,
    acOpen,
    acItems,
    acIndex,
    acMode,
    acAnchor,
    caretCtx,
    onChange: (next, pos) =>
      handleChange(
        next,
        pos,
        expanded ? expandedTextareaRef.current : textareaRef.current
      ),
    onKeyDown: handleKeyDown,
    onSelect: (pos) => {
      setCaret(pos);
      refreshAutocomplete(
        raw,
        pos,
        expanded ? expandedTextareaRef.current : textareaRef.current
      );
    },
    onBlur: handleBlur,
    onPickAc: insertCompletion,
  };

  const expandedModal =
    expanded &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        className="fixed inset-0 z-[200] flex items-stretch justify-center bg-black/80 p-3 sm:p-6"
        onClick={() => {
          flushApply();
          setExpanded(false);
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Editor CSS avanzado expandido"
      >
        <div
          className="flex w-full max-w-4xl flex-col rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] px-4 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--color-text)]">CSS avanzado</p>
              <p className="text-[10px] text-[var(--color-muted)]">
                {elementLabel ? `${elementLabel} · ` : ""}
                Se aplica solo al escribir
              </p>
            </div>
            <button
              type="button"
              className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-hover)]"
              onClick={() => {
                flushApply();
                setExpanded(false);
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {childSuggestions.length > 0 && (
            <div className="flex shrink-0 flex-wrap gap-1 border-b border-[var(--color-border-subtle)] px-3 py-2">
              {childSuggestions.map((child) => (
                <button
                  key={child.token}
                  type="button"
                  className="rounded-md border border-[var(--color-border-subtle)] px-2 py-0.5 font-mono text-[10px] hover:border-[var(--color-accent)]/40"
                  onClick={() => {
                    const snippet = buildHubCssChildSnippet(child);
                    const next = raw.trim() ? `${raw.trim()}\n\n${snippet}` : snippet;
                    setRaw(next);
                  }}
                >
                  .{child.token} · {child.label}
                </button>
              ))}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-hidden p-3">
            <CssEditorPane
              {...sharedPaneProps}
              tall
              textareaRef={expandedTextareaRef}
              preRef={expandedPreRef}
              gutterRef={expandedGutterRef}
              onScroll={() => {
                syncScroll(expandedTextareaRef.current, expandedPreRef.current, expandedGutterRef.current);
                handleScrollWithAc(expandedTextareaRef.current);
              }}
            />
          </div>

          <div className="flex shrink-0 flex-wrap gap-1.5 border-t border-[var(--color-border-subtle)] px-3 py-2">
            {HUB_CSS_SNIPPETS.map((snip) => (
              <button
                key={snip.label}
                type="button"
                className="rounded-md bg-[var(--color-surface)] px-2 py-1 text-[10px] hover:bg-[var(--color-surface-hover)]"
                onClick={() => setRaw(raw.trim() ? `${raw.trim()}\n${snip.insert}` : snip.insert)}
              >
                {snip.label}
              </button>
            ))}
          </div>
        </div>
      </div>,
      document.body
    );

  return (
    <div className="space-y-2" onFocus={handleFocus}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium text-[var(--color-text-soft)]">CSS</span>
        <div className="flex items-center gap-1">
          <span className="font-mono text-[9px] uppercase tracking-wide text-[var(--color-muted)]">
            {childSuggestions.length > 0 ? `${childSuggestions.length} hijos` : "Mini CSS"}
          </span>
          <button
            type="button"
            className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-accent)]"
            title="Expandir editor"
            onClick={() => setExpanded(true)}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <CssEditorPane
        {...sharedPaneProps}
        textareaRef={textareaRef}
        preRef={preRef}
        gutterRef={gutterRef}
        onScroll={() => {
          syncScroll(textareaRef.current, preRef.current, gutterRef.current);
          handleScrollWithAc(textareaRef.current);
        }}
      />

      <div className="text-[10px] text-[var(--color-muted)]">
        Se aplica solo (0,2 s) · Tab autocompleta · Enter sangría · Backspace salta sangría · Ctrl+Espacio
      </div>

      {expandedModal}
    </div>
  );
}
