import { compileFriendlyScript } from "@/lib/hub-script-sugar";
import { isValidRefId } from "@/lib/hub-logic-utils";

export const HUB_SCRIPT_LANGUAGE = "HubScript";

export type ScriptLintSeverity = "error" | "warning";

export interface ScriptLintIssue {
  from: number;
  to: number;
  line: number;
  column: number;
  message: string;
  severity: ScriptLintSeverity;
  code: string;
}

export interface ScriptLintContext {
  availableRefs: string[];
  constants: Record<string, string | number | boolean>;
}

const STRING_PATTERN = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;

function offsetToLineCol(source: string, offset: number): { line: number; column: number } {
  const before = source.slice(0, offset);
  const line = before.split("\n").length;
  const lastNl = before.lastIndexOf("\n");
  const column = offset - lastNl;
  return { line, column };
}

function addIssue(
  issues: ScriptLintIssue[],
  source: string,
  from: number,
  to: number,
  message: string,
  severity: ScriptLintSeverity,
  code: string
) {
  if (issues.some((i) => i.from === from && i.code === code)) return;
  const { line, column } = offsetToLineCol(source, from);
  issues.push({ from, to: Math.max(to, from + 1), line, column, message, severity, code });
}

function forEachOutsideStrings(source: string, fn: (chunk: string, offset: number) => void) {
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(STRING_PATTERN.source, "g");
  while ((match = re.exec(source)) !== null) {
    if (match.index > last) fn(source.slice(last, match.index), last);
    last = match.index + match[0].length;
  }
  if (last < source.length) fn(source.slice(last), last);
}

function lintStringsAndBrackets(source: string, issues: ScriptLintIssue[]) {
  let lineStart = 0;
  const stack: { ch: string; from: number }[] = [];
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  let inString: string | null = null;
  let escaped = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];

    if (ch === "\n") {
      if (inString) {
        addIssue(
          issues,
          source,
          lineStart,
          i,
          `Cadena ${inString} sin cerrar`,
          "error",
          "HUB-STRING"
        );
        inString = null;
        escaped = false;
      }
      lineStart = i + 1;
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      continue;
    }

    if (ch === "/" && source[i + 1] === "/") {
      const nl = source.indexOf("\n", i);
      i = nl === -1 ? source.length - 1 : nl;
      continue;
    }

    if (ch === "(" || ch === "[" || ch === "{") {
      stack.push({ ch, from: i });
      continue;
    }

    if (ch === ")" || ch === "]" || ch === "}") {
      const expected = pairs[ch];
      const top = stack.pop();
      if (!top || top.ch !== expected) {
        addIssue(
          issues,
          source,
          i,
          i + 1,
          top ? `Se esperaba '${top.ch === "(" ? ")" : top.ch === "[" ? "]" : "}"}'` : `'${ch}' sin apertura`,
          "error",
          "HUB-BRACKET"
        );
      }
    }
  }

  if (inString) {
    addIssue(
      issues,
      source,
      lineStart,
      source.length,
      `Cadena ${inString} sin cerrar`,
      "error",
      "HUB-STRING"
    );
  }

  for (const open of stack) {
    const close = open.ch === "(" ? ")" : open.ch === "[" ? "]" : "}";
    addIssue(
      issues,
      source,
      open.from,
      open.from + 1,
      `'${open.ch}' sin cerrar — falta '${close}'`,
      "error",
      "HUB-BRACKET"
    );
  }
}

function lintFriendlyTokens(source: string, ctx: ScriptLintContext, issues: ScriptLintIssue[]) {
  const refSet = new Set(ctx.availableRefs);
  const constSet = new Set(Object.keys(ctx.constants));

  forEachOutsideStrings(source, (chunk, baseOffset) => {
    let m: RegExpExecArray | null;

    const bareRef = /\$(?![A-Za-z_])/g;
    while ((m = bareRef.exec(chunk)) !== null) {
      addIssue(
        issues,
        source,
        baseOffset + m.index,
        baseOffset + m.index + 1,
        "Después de $ va el nombre del ref (ej. $contador1)",
        "error",
        "HUB-REF-SYNTAX"
      );
    }

    const bareConst = /@(?![A-Za-z_])/g;
    while ((m = bareConst.exec(chunk)) !== null) {
      addIssue(
        issues,
        source,
        baseOffset + m.index,
        baseOffset + m.index + 1,
        "Después de @ va el nombre de la constante (ej. @GOAL)",
        "error",
        "HUB-CONST-SYNTAX"
      );
    }

    const bareGlobal = /~(?![A-Za-z_])/g;
    while ((m = bareGlobal.exec(chunk)) !== null) {
      addIssue(
        issues,
        source,
        baseOffset + m.index,
        baseOffset + m.index + 1,
        "Después de ~ va el nombre global (ej. ~visitas)",
        "error",
        "HUB-GLOBAL-SYNTAX"
      );
    }

    const refUse = /\$([A-Za-z_][A-Za-z0-9_]*)/g;
    while ((m = refUse.exec(chunk)) !== null) {
      const name = m[1];
      const from = baseOffset + m.index;
      const to = from + m[0].length;
      if (!isValidRefId(name)) {
        addIssue(issues, source, from, to, `Ref '$${name}' tiene ID inválido`, "error", "HUB-REF-INVALID");
      } else if (refSet.size > 0 && !refSet.has(name)) {
        addIssue(
          issues,
          source,
          from,
          to,
          `Ref '$${name}' no existe en esta pantalla`,
          "warning",
          "HUB-REF-UNKNOWN"
        );
      }
    }

    const constUse = /@([A-Za-z_][A-Za-z0-9_]*)/g;
    while ((m = constUse.exec(chunk)) !== null) {
      const name = m[1];
      const from = baseOffset + m.index;
      const to = from + m[0].length;
      if (constSet.size > 0 && !constSet.has(name)) {
        addIssue(
          issues,
          source,
          from,
          to,
          `Constante '@${name}' no está definida en el panel`,
          "warning",
          "HUB-CONST-UNKNOWN"
        );
      } else if (constSet.size === 0) {
        addIssue(
          issues,
          source,
          from,
          to,
          `Constante '@${name}' — añádela en el JSON de constantes`,
          "warning",
          "HUB-CONST-MISSING"
        );
      }
    }

    const refInFn =
      /\b(?:mostrar|show|ocultar|hide|alternar|ejecutar|run|set|label|pantalla|leer|existe|ctx\.(?:show|hide|toggleVisible|run|setValue|setLabel|getValue|get|exists|num|val|setScreen))\s*\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']/g;
    while ((m = refInFn.exec(chunk)) !== null) {
      const name = m[1];
      const nameIdx = m[0].lastIndexOf(name);
      const from = baseOffset + m.index + nameIdx;
      const to = from + name.length;
      if (!isValidRefId(name)) {
        addIssue(issues, source, from, to, `Ref '${name}' inválido`, "error", "HUB-REF-INVALID");
      } else if (refSet.size > 0 && !refSet.has(name)) {
        addIssue(
          issues,
          source,
          from,
          to,
          `Ref '${name}' no existe en esta pantalla`,
          "warning",
          "HUB-REF-UNKNOWN"
        );
      }
    }
  });
}

function lintCompiledJs(source: string, issues: ScriptLintIssue[]) {
  if (!source.trim()) return;
  try {
    const compiled = compileFriendlyScript(source);
    new Function("ctx", `"use strict";\nreturn (async () => {\n${compiled}\n})();`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const lineMatch = msg.match(/:(\d+)(?::(\d+))?/);
    let from = 0;
    let to = Math.min(source.length, 1);
    if (lineMatch) {
      const jsLine = Number(lineMatch[1]);
      const hubLines = source.split("\n");
      const hubLineIdx = Math.min(Math.max(jsLine - 2, 0), hubLines.length - 1);
      from = hubLines.slice(0, hubLineIdx).reduce((a, l) => a + l.length + 1, 0);
      to = from + hubLines[hubLineIdx].length;
    }
    addIssue(
      issues,
      source,
      from,
      to,
      `Sintaxis JS: ${msg.replace(/^SyntaxError:\s*/i, "")}`,
      "error",
      "HUB-JS-SYNTAX"
    );
  }
}

/** Analiza un script HubScript y devuelve errores/advertencias */
export function lintFriendlyScript(source: string, ctx: ScriptLintContext): ScriptLintIssue[] {
  if (!source.trim()) return [];

  const issues: ScriptLintIssue[] = [];
  lintStringsAndBrackets(source, issues);
  lintFriendlyTokens(source, ctx, issues);

  const hasSyntaxError = issues.some(
    (i) => i.severity === "error" && (i.code.startsWith("HUB-STRING") || i.code === "HUB-BRACKET")
  );
  if (!hasSyntaxError) {
    lintCompiledJs(source, issues);
  }

  return issues.sort((a, b) => a.from - b.from || a.code.localeCompare(b.code));
}

export function lintSummary(issues: ScriptLintIssue[]): string {
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  if (errors === 0 && warnings === 0) return "Sin errores";
  const parts: string[] = [];
  if (errors) parts.push(`${errors} error${errors === 1 ? "" : "es"}`);
  if (warnings) parts.push(`${warnings} aviso${warnings === 1 ? "" : "s"}`);
  return parts.join(", ");
}

export function linesWithIssues(issues: ScriptLintIssue[]): Set<number> {
  return new Set(issues.map((i) => i.line));
}

export function issueOverlaps(from: number, to: number, issues: ScriptLintIssue[]): boolean {
  return issues.some((i) => i.from < to && i.to > from);
}

export function worstSeverityOnRange(
  from: number,
  to: number,
  issues: ScriptLintIssue[]
): ScriptLintSeverity | null {
  let worst: ScriptLintSeverity | null = null;
  for (const issue of issues) {
    if (issue.from < to && issue.to > from) {
      if (issue.severity === "error") return "error";
      worst = "warning";
    }
  }
  return worst;
}
