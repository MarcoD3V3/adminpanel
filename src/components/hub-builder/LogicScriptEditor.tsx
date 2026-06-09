"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LINT_ERROR_COLOR,
  LINT_WARNING_COLOR,
  TOKEN_COLORS,
  tokenizeFriendlyScript,
} from "@/lib/hub-script-highlight";
import {
  detectScriptSuggestions,
  SUGGESTION_KIND_COLORS,
  SUGGESTION_KIND_LABELS,
  type ScriptSuggestion,
} from "@/lib/hub-script-autocomplete";
import {
  compileFriendlyScript,
  describeFriendlyScript,
  FRIENDLY_GUIDE,
} from "@/lib/hub-script-sugar";
import {
  elementTypeSnippetLabel,
  getContextualSnippets,
  getGeneralSnippets,
  groupSnippets,
  triggerSnippetHint,
} from "@/lib/hub-script-snippets-contextual";
import type { HubElementType, HubScriptMode, LogicTrigger } from "@/types/hub-builder";
import {
  compileSimpleScript,
  compileSimpleToHub,
  describeSimpleScript,
  isSimpleScriptMode,
  SIMPLE_SCRIPT_GUIDE,
  SIMPLE_SNIPPETS,
} from "@/lib/hub-script-simple";
import {
  HUB_SCRIPT_LANGUAGE,
  lintFriendlyScript,
  lintSummary,
  linesWithIssues,
  worstSeverityOnRange,
  type ScriptLintIssue,
} from "@/lib/hub-script-lint";
import { ScriptWizard } from "@/components/hub-builder/ScriptWizard";

interface RefOption {
  refId: string;
  label: string;
}

interface ScreenOption {
  id: string;
  name: string;
}

interface LogicScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  refId?: string;
  elementType?: HubElementType;
  trigger?: LogicTrigger;
  scriptMode?: HubScriptMode;
  onScriptModeChange?: (mode: HubScriptMode) => void;
  constants?: Record<string, string | number | boolean>;
  availableRefs?: RefOption[];
  screens?: ScreenOption[];
  showAdvancedApi?: boolean;
  onToggleAdvancedApi?: () => void;
  advancedApiOpen?: boolean;
  advancedApiPanel?: React.ReactNode;
}

const EDITOR_LINE = "leading-[1.65rem]";
const EDITOR_FONT = cn("font-mono text-[12px] tab-size-2", EDITOR_LINE);
const EDITOR_PAD = "px-3 py-2";

function HighlightedLines({ source, issues }: { source: string; issues: ScriptLintIssue[] }) {
  const lines = useMemo(() => source.split("\n"), [source]);

  return (
    <>
      {lines.map((line, lineIdx) => {
        const lineStart = lines.slice(0, lineIdx).reduce((acc, l) => acc + l.length + 1, 0);
        const tokens = tokenizeFriendlyScript(line);
        return (
          <div key={lineIdx} className={cn("whitespace-pre", EDITOR_LINE)}>
            {tokens.length === 0 ? "\u00A0" : null}
            {tokens.map((t, i) => {
              const from = lineStart + t.from;
              const to = lineStart + t.to;
              const severity = worstSeverityOnRange(from, to, issues);
              const color =
                severity === "error"
                  ? LINT_ERROR_COLOR
                  : severity === "warning"
                    ? LINT_WARNING_COLOR
                    : TOKEN_COLORS[t.kind];
              return (
                <span
                  key={i}
                  style={{
                    color,
                    backgroundColor:
                      severity === "error"
                        ? "rgba(248,113,113,0.12)"
                        : severity === "warning"
                          ? "rgba(251,191,36,0.1)"
                          : undefined,
                    borderRadius: severity ? 2 : undefined,
                  }}
                >
                  {t.text}
                </span>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

interface EditorPaneProps {
  value: string;
  lineCount: number;
  tall: boolean;
  issues: ScriptLintIssue[];
  placeholder?: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onClick: (e: React.MouseEvent<HTMLTextAreaElement>) => void;
  onBlur: () => void;
  suggestions: ScriptSuggestion[];
  selectedIdx: number;
  onPickSuggestion: (item: ScriptSuggestion) => void;
}

function LintPanel({ issues }: { issues: ScriptLintIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <div className="max-h-20 space-y-1 overflow-y-auto rounded-md border border-[var(--color-border-subtle)] bg-[#08090b]/80 px-2.5 py-2">
      {issues.slice(0, 6).map((issue, i) => (
        <p
          key={`${issue.code}-${issue.from}-${i}`}
          className={cn(
            "font-mono text-[9px] leading-snug",
            issue.severity === "error" ? "text-[#f87171]" : "text-[#fbbf24]"
          )}
        >
          <span className="opacity-50">L{issue.line}</span> {issue.message}
        </p>
      ))}
      {issues.length > 6 && (
        <p className="text-[9px] text-[var(--color-muted)]">+{issues.length - 6} más…</p>
      )}
    </div>
  );
}

function EditorPane({
  value,
  lineCount,
  tall,
  issues,
  placeholder,
  textareaRef,
  onChange,
  onKeyDown,
  onClick,
  onBlur,
  suggestions,
  selectedIdx,
  onPickSuggestion,
}: EditorPaneProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const errorLines = useMemo(() => linesWithIssues(issues), [issues]);
  const hasErrors = issues.some((i) => i.severity === "error");
  const lines = useMemo(() => value.split("\n"), [value]);
  const displayLineCount = Math.max(10, lines.length);

  const syncPreScroll = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = ta.scrollTop;
    }
  };

  return (
    <div className="space-y-1">
      <div
        className={cn(
          "overflow-hidden rounded-lg border bg-[#0a0c0f]",
          hasErrors
            ? "border-[#f87171]/40"
            : issues.length > 0
              ? "border-[#fbbf24]/30"
              : "border-[var(--color-border-subtle)]",
          tall ? "flex min-h-0 flex-1 flex-col" : ""
        )}
      >
        <div className={cn("flex", tall ? "min-h-0 flex-1" : "max-h-[280px] min-h-[200px]")}>
          <div
            ref={gutterRef}
            className={cn(
              "select-none shrink-0 overflow-hidden border-r border-[var(--color-border-subtle)] bg-[#08090b] py-2 pl-2 pr-2.5 text-right",
              EDITOR_FONT
            )}
            aria-hidden
          >
            {Array.from({ length: displayLineCount }, (_, i) => {
              const n = i + 1;
              const hasLine = i < lines.length;
              const lineIssue = issues.find((iss) => iss.line === n);
              return (
                <div
                  key={i}
                  className={cn(
                    EDITOR_LINE,
                    !hasLine && "opacity-30",
                    lineIssue?.severity === "error"
                      ? "text-[#f87171]"
                      : errorLines.has(n)
                        ? "text-[#fbbf24]"
                        : "text-[var(--color-muted)]"
                  )}
                >
                  {n}
                </div>
              );
            })}
          </div>

          <div className={cn("relative min-w-0 flex-1", tall ? "min-h-0" : "min-h-[200px]")}>
            <pre
              ref={preRef}
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-0 m-0 overflow-hidden",
                EDITOR_PAD,
                EDITOR_FONT
              )}
            >
              <HighlightedLines source={value} issues={issues} />
            </pre>

            <textarea
              ref={textareaRef}
              value={value}
              onChange={onChange}
              onKeyDown={onKeyDown}
              onClick={onClick}
              onBlur={onBlur}
              onScroll={syncPreScroll}
              wrap="off"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              autoComplete="off"
              data-gramm="false"
              data-gramm_editor="false"
              data-enable-grammarly="false"
              placeholder={
                placeholder ??
                `// Escribe en español o JS simple\nconst puntos = $contador1;\nconst meta = @GOAL ?? 10;\n\nif (puntos >= meta) {\n  avisa("Meta alcanzada");\n}`
              }
              className={cn(
                "relative z-[1] block h-full w-full resize-none overflow-auto bg-transparent",
                EDITOR_PAD,
                EDITOR_FONT,
                tall ? "min-h-0" : "min-h-[200px]",
                "whitespace-pre text-transparent caret-[var(--color-accent)]",
                "selection:bg-[var(--color-accent)]/25 selection:text-transparent",
                "outline-none placeholder:text-[var(--color-muted)]/40"
              )}
              style={{ tabSize: 2 }}
            />

            {suggestions.length > 0 && (
              <div className="absolute left-3 top-8 z-10 max-h-48 w-[min(100%,22rem)] overflow-y-auto rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface)] py-1 shadow-lg">
                {suggestions.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onPickSuggestion(item);
                    }}
                    className={cn(
                      "flex w-full items-start gap-2 px-2.5 py-1.5 text-left",
                      i === selectedIdx
                        ? "bg-[var(--color-accent-soft)]"
                        : "hover:bg-[var(--color-surface-hover)]"
                    )}
                  >
                    <span
                      className="mt-0.5 shrink-0 rounded px-1 py-px font-mono text-[8px] font-medium uppercase tracking-wide"
                      style={{
                        color: SUGGESTION_KIND_COLORS[item.kind],
                        backgroundColor: `${SUGGESTION_KIND_COLORS[item.kind]}18`,
                      }}
                    >
                      {SUGGESTION_KIND_LABELS[item.kind]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate font-mono text-[11px]"
                        style={{ color: SUGGESTION_KIND_COLORS[item.kind] }}
                      >
                        {item.label}
                      </span>
                      {item.hint && (
                        <span className="block truncate text-[9px] text-[var(--color-muted)]">{item.hint}</span>
                      )}
                    </span>
                  </button>
                ))}
                <p className="border-t border-[var(--color-border-subtle)] px-2 py-1 text-[8px] text-[var(--color-muted)]">
                  ↑↓ navegar · Enter insertar · Ctrl+Space todas
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <LintPanel issues={issues} />
    </div>
  );
}

export function LogicScriptEditor({
  value,
  onChange,
  refId,
  elementType = "button",
  trigger = "click",
  scriptMode = "simple",
  onScriptModeChange,
  constants,
  availableRefs = [],
  screens = [],
  showAdvancedApi,
  onToggleAdvancedApi,
  advancedApiOpen,
  advancedApiPanel,
}: LogicScriptEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [showCompiled, setShowCompiled] = useState(false);
  const [suggestions, setSuggestions] = useState<ScriptSuggestion[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const simpleMode = isSimpleScriptMode(scriptMode);

  const lineCount = useMemo(() => Math.max(10, value.split("\n").length), [value]);
  const summary = useMemo(
    () => (simpleMode ? describeSimpleScript(value) : describeFriendlyScript(value)),
    [value, simpleMode]
  );
  const compiled = useMemo(() => {
    if (!value.trim()) return "";
    return simpleMode ? compileSimpleScript(value) : compileFriendlyScript(value);
  }, [value, simpleMode]);
  const lintSource = useMemo(
    () => (simpleMode ? compileSimpleToHub(value) : value),
    [value, simpleMode]
  );
  const constKeys = constants ? Object.keys(constants) : [];
  const refIds = useMemo(() => availableRefs.map((r) => r.refId), [availableRefs]);
  const lintIssues = useMemo(
    () =>
      lintFriendlyScript(lintSource, {
        availableRefs: refIds,
        constants: constants ?? {},
      }),
    [lintSource, refIds, constants]
  );
  const lintStatus = useMemo(() => lintSummary(lintIssues), [lintIssues]);

  const closeExpanded = useCallback(() => {
    onChange(value);
    setExpanded(false);
    setSuggestions([]);
  }, [onChange, value]);

  useEffect(() => {
    if (!expanded) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeExpanded();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded, closeExpanded]);

  useEffect(() => {
    if (expanded) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [expanded]);

  const insertAtCursor = useCallback(
    (code: string, replaceFrom?: number, replaceTo?: number) => {
      const ta = textareaRef.current;
      const start = replaceFrom ?? ta?.selectionStart ?? value.length;
      const end = replaceTo ?? ta?.selectionEnd ?? value.length;
      const next = `${value.slice(0, start)}${code}${value.slice(end)}`;
      onChange(next);
      requestAnimationFrame(() => {
        ta?.focus();
        const pos = start + code.length;
        ta?.setSelectionRange(pos, pos);
      });
    },
    [onChange, value]
  );

  const insertSnippet = useCallback(
    (code: string) => {
      const ta = textareaRef.current;
      if (!ta) {
        onChange(value ? `${value}\n\n${code}` : code);
        return;
      }
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = value.slice(0, start);
      const after = value.slice(end);
      const spacer = before && !before.endsWith("\n") ? "\n" : "";
      const next = `${before}${spacer}${code}${after ? `\n${after}` : ""}`;
      onChange(next);
      requestAnimationFrame(() => {
        ta.focus();
        const pos = (before + spacer + code).length;
        ta.setSelectionRange(pos, pos);
      });
    },
    [onChange, value]
  );

  const autocompleteCtx = useMemo(
    () => ({
      scriptMode: (simpleMode ? "simple" : "hub") as HubScriptMode,
      elementType,
      trigger,
      refId,
      refs: availableRefs,
      constants: constants ?? {},
      screens,
    }),
    [simpleMode, elementType, trigger, refId, availableRefs, constants, screens]
  );

  const updateSuggestions = useCallback(
    (text: string, cursor: number, forceAll = false) => {
      const items = detectScriptSuggestions(text, cursor, autocompleteCtx, forceAll);
      setSuggestions(items);
      setSelectedIdx(0);
    },
    [autocompleteCtx]
  );

  const applySuggestion = useCallback(
    (item: ScriptSuggestion) => {
      const ta = textareaRef.current;
      const cursor = ta?.selectionStart ?? value.length;

      if (item.replaceStart < 0) {
        insertSnippet(item.insert);
      } else {
        insertAtCursor(item.insert, item.replaceStart, item.replaceEnd || cursor);
      }
      setSuggestions([]);
    },
    [insertAtCursor, insertSnippet, value.length]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next);
    updateSuggestions(next, e.target.selectionStart);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key === " ") {
      e.preventDefault();
      updateSuggestions(value, e.currentTarget.selectionStart, true);
      return;
    }

    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        applySuggestion(suggestions[selectedIdx]);
        return;
      }
      if (e.key === "Escape") {
        e.stopPropagation();
        setSuggestions([]);
        return;
      }
    }

    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = `${value.slice(0, start)}  ${value.slice(end)}`;
      onChange(next);
      requestAnimationFrame(() => {
        ta.setSelectionRange(start + 2, start + 2);
      });
    }
  };

  const snippetGroups = useMemo(() => groupSnippets(getGeneralSnippets()), []);

  const contextualSnippets = useMemo(
    () => (simpleMode ? [] : getContextualSnippets({ elementType, trigger, refId })),
    [simpleMode, elementType, trigger, refId]
  );

  const contextualGroups = useMemo(() => groupSnippets(contextualSnippets), [contextualSnippets]);

  const simpleSnippetsRow = simpleMode ? (
    <div className="space-y-1">
      <span className="text-[9px] font-medium uppercase tracking-wide text-[var(--color-accent)]">
        Atajos simples
      </span>
      <div className="flex flex-wrap gap-1">
        {SIMPLE_SNIPPETS.map((s) => (
          <button
            key={s.label}
            type="button"
            title={s.hint}
            onClick={() => insertSnippet(s.code)}
            className="rounded-md border border-[var(--color-accent-muted)]/40 bg-[var(--color-accent-soft)]/30 px-2 py-0.5 font-mono text-[10px] text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  const renderSnippetButtons = (
    groups: [string, { label: string; code: string; hint?: string }[]][],
    accent?: boolean
  ) => (
    <div className="space-y-1">
      {groups.map(([group, snips]) => (
        <div key={group} className="flex flex-wrap items-center gap-1">
          <span className="w-full shrink-0 text-[8px] uppercase tracking-wide text-[var(--color-muted)] sm:w-auto sm:min-w-[72px]">
            {group}
          </span>
          {snips.map((snip) => (
            <button
              key={`${group}-${snip.label}`}
              type="button"
              title={snip.hint ?? snip.label}
              onClick={() => insertSnippet(snip.code)}
              className={cn(
                "max-w-[88px] truncate rounded-md border px-2 py-0.5 font-mono text-[10px] transition-colors",
                accent
                  ? "border-[var(--color-accent-muted)]/50 bg-[var(--color-accent-soft)]/40 text-[var(--color-accent)] hover:border-[var(--color-accent-muted)] hover:bg-[var(--color-accent-soft)]"
                  : "border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-text-soft)] hover:border-[var(--color-accent-muted)] hover:text-[var(--color-text)]"
              )}
            >
              {snip.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );

  const contextualRow =
    contextualGroups.length > 0 ? (
      <div className="space-y-1.5 rounded-lg border border-[var(--color-accent-muted)]/30 bg-[var(--color-accent-soft)]/5 p-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-[9px] font-medium uppercase tracking-wide text-[var(--color-accent)]">
            Para {elementTypeSnippetLabel(elementType)}
          </span>
          <span className="text-[9px] text-[var(--color-muted)]">· {triggerSnippetHint(trigger)}</span>
        </div>
        <div className="max-h-[108px] overflow-y-auto pr-0.5">{renderSnippetButtons(contextualGroups, true)}</div>
      </div>
    ) : null;

  const generalRow = !simpleMode ? (
    <div className="space-y-1">
      <span className="text-[9px] font-medium uppercase tracking-wide text-[var(--color-muted)]">Generales</span>
      <div className="max-h-[96px] overflow-y-auto pr-0.5">{renderSnippetButtons(snippetGroups)}</div>
    </div>
  ) : null;

  const snippetsRow = (
    <div className="space-y-2">
      {simpleSnippetsRow}
      {contextualRow}
      {generalRow}
    </div>
  );

  const chipsRow = (constKeys.length > 0 || availableRefs.length > 0) && (
    <div className="space-y-1">
      {availableRefs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[9px] text-[var(--color-muted)]">Refs en pantalla:</span>
          {availableRefs.map((r, i) => (
            <button
              key={`${r.refId}-${i}`}
              type="button"
              title={r.label}
              onClick={() => insertSnippet(simpleMode ? `refs.${r.refId}` : `$${r.refId}`)}
              className="rounded bg-[var(--color-surface-hover)] px-1.5 py-0.5 font-mono text-[9px] text-[#7eb8ff] hover:bg-[var(--color-accent-soft)]"
            >
              {simpleMode ? `refs.${r.refId}` : `$${r.refId}`}
            </button>
          ))}
        </div>
      )}
      {constKeys.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[9px] text-[var(--color-muted)]">Constantes:</span>
          {constKeys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => insertSnippet(`@${k}`)}
              className="rounded bg-[var(--color-surface-hover)] px-1.5 py-0.5 font-mono text-[9px] text-[#e8c468] hover:bg-[var(--color-accent-soft)]"
            >
              @{k}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const editorPlaceholder = simpleMode
    ? `// Modo Simple — escribe como en JS normal\n// El disparador (clic, cambio…) ya está en Propiedades\n\nsi $contador >= @META {\n  avisa("¡Listo!");\n} sino {\n  sumar($contador, 1);\n}`
    : undefined;

  const modeToggle = onScriptModeChange && (
    <div className="flex rounded-lg border border-[var(--color-border-subtle)] p-0.5 text-[10px]">
      <button
        type="button"
        onClick={() => onScriptModeChange("simple")}
        className={cn(
          "rounded-md px-2.5 py-1 font-medium transition-colors",
          simpleMode
            ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
            : "text-[var(--color-muted)] hover:text-[var(--color-text-soft)]"
        )}
      >
        Simple
      </button>
      <button
        type="button"
        onClick={() => {
          if (simpleMode && value.trim()) {
            onScriptModeChange("hub");
            onChange(compileSimpleToHub(value));
          } else {
            onScriptModeChange("hub");
          }
        }}
        className={cn(
          "rounded-md px-2.5 py-1 font-medium transition-colors",
          !simpleMode
            ? "bg-[var(--color-surface-hover)] text-[var(--color-text)]"
            : "text-[var(--color-muted)] hover:text-[var(--color-text-soft)]"
        )}
      >
        HubScript
      </button>
    </div>
  );

  const editorPaneProps: EditorPaneProps = {
    value,
    lineCount,
    tall: expanded,
    issues: lintIssues,
    placeholder: editorPlaceholder,
    textareaRef,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    onClick: (e) => updateSuggestions(value, e.currentTarget.selectionStart),
    onBlur: () => setTimeout(() => setSuggestions([]), 120),
    suggestions,
    selectedIdx,
    onPickSuggestion: applySuggestion,
  };

  const expandedModal =
    expanded &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        className="fixed inset-0 z-[200] flex items-stretch justify-center bg-black/80 p-3 sm:p-6"
        onClick={closeExpanded}
        role="dialog"
        aria-modal="true"
        aria-label="Editor de script expandido"
      >
        <div
          className="flex w-full max-w-5xl flex-col rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] px-4 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--color-text)]">Editor de script</p>
              <p className="text-[10px] text-[var(--color-muted)]">
                Clic fuera o Esc para guardar y cerrar
                {refId ? (
                  <>
                    {" "}
                    · ref: <span className="font-mono text-[var(--color-accent)]">{refId}</span>
                  </>
                ) : null}
                {value.trim() ? (
                  <>
                    {" "}
                    ·{" "}
                    <span
                      className={
                        lintIssues.some((i) => i.severity === "error") ? "text-[#f87171]" : lintIssues.length ? "text-[#fbbf24]" : "text-[var(--color-accent)]"
                      }
                    >
                      {lintStatus}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            <button
              type="button"
              onClick={closeExpanded}
              className="shrink-0 rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
              aria-label="Cerrar editor"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-4">
            {modeToggle}
            {snippetsRow}
            {chipsRow}
            <EditorPane {...editorPaneProps} tall />
          </div>
        </div>
      </div>,
      document.body
    );

  if (expanded) {
    return expandedModal;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {modeToggle}
          <label className="text-xs font-medium text-[var(--color-text-soft)]">
            {simpleMode ? "Lógica simple" : "HubScript"}
          </label>
        </div>
        <div className="flex items-center gap-2">
          {summary && (
            <span className="rounded bg-[var(--color-surface-hover)] px-1.5 py-0.5 text-[9px] text-[var(--color-muted)]">
              {summary}
            </span>
          )}
          {value.trim() && (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-[9px]",
                lintIssues.some((i) => i.severity === "error")
                  ? "bg-[#f87171]/15 text-[#f87171]"
                  : lintIssues.length > 0
                    ? "bg-[#fbbf24]/15 text-[#fbbf24]"
                    : "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
              )}
              title={`Linter ${HUB_SCRIPT_LANGUAGE}`}
            >
              {lintStatus}
            </span>
          )}
          {refId && (
            <span className="font-mono text-[10px] text-[var(--color-muted)]">
              ref: <span className="text-[var(--color-accent)]">{refId}</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            title="Expandir editor"
            className="rounded border border-[var(--color-border-subtle)] p-1 text-[var(--color-muted)] hover:border-[var(--color-accent-muted)] hover:text-[var(--color-accent)]"
            aria-label="Expandir editor de script"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!simpleMode && (
        <ScriptWizard
          availableRefs={availableRefs}
          constants={constants ?? {}}
          currentRefId={refId}
          onInsert={insertSnippet}
        />
      )}

      {simpleMode && (
        <p className="text-[10px] leading-relaxed text-[var(--color-muted)]">
          Escribe en español con <span className="font-mono text-[var(--color-accent)]">si / sino</span>,{" "}
          <span className="font-mono">avisa()</span>, <span className="font-mono">sumar($ref)</span>. También{" "}
          <span className="font-mono">refs.nombre</span> y <span className="font-mono">alert()</span> como en el
          navegador.
        </p>
      )}

      {snippetsRow}
      {chipsRow}
      <EditorPane {...editorPaneProps} tall={false} />

      <button
        type="button"
        onClick={() => setShowCompiled(!showCompiled)}
        className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-accent)]"
      >
        {showCompiled ? "Ocultar código compilado" : "Ver qué se ejecuta realmente →"}
      </button>
      {showCompiled && compiled && (
        <pre className="max-h-24 overflow-y-auto rounded-md border border-[var(--color-border-subtle)] bg-[#08090b] p-2 font-mono text-[9px] leading-relaxed text-[var(--color-muted)]">
          {compiled}
        </pre>
      )}

      <details className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2">
        <summary className="cursor-pointer text-[10px] font-medium text-[var(--color-text-soft)]">
          {simpleMode ? "Guía — Modo Simple" : "Guía rápida — sintaxis amigable"}
        </summary>
        <div className="mt-2 space-y-2">
          {(simpleMode ? SIMPLE_SCRIPT_GUIDE : FRIENDLY_GUIDE).map((section) => (
            <div key={section.title}>
              <p className="text-[10px] font-medium text-[var(--color-accent)]">{section.title}</p>
              <ul className="mt-0.5 space-y-0.5">
                {section.examples.map((ex) => (
                  <li key={ex} className="font-mono text-[9px] text-[var(--color-muted)]">
                    {ex}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>

      {showAdvancedApi && onToggleAdvancedApi && (
        <>
          <button
            type="button"
            onClick={onToggleAdvancedApi}
            className="text-[10px] text-[var(--color-accent)] hover:underline"
          >
            {advancedApiOpen ? "Ocultar API avanzada" : "Ver API avanzada (ctx.*)"}
          </button>
          {advancedApiOpen && advancedApiPanel}
        </>
      )}
    </div>
  );
}
