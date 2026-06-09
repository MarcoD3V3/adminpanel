export type ScriptTokenKind =
  | "comment"
  | "string"
  | "ref"
  | "const"
  | "global"
  | "fn"
  | "keyword"
  | "number"
  | "plain";

export interface ScriptToken {
  text: string;
  kind: ScriptTokenKind;
  from: number;
  to: number;
}

const KEYWORDS = new Set([
  "if",
  "si",
  "else",
  "sino",
  "fin",
  "const",
  "let",
  "var",
  "return",
  "await",
  "async",
  "for",
  "while",
  "try",
  "catch",
  "true",
  "false",
  "null",
  "undefined",
  "function",
]);

const FRIENDLY_FNS = new Set([
  "toast",
  "avisa",
  "alert",
  "show",
  "mostrar",
  "hide",
  "ocultar",
  "run",
  "ejecutar",
  "log",
  "registrar",
  "set",
  "poner",
  "label",
  "ponerTexto",
  "alternar",
  "esperar",
  "aleatorio",
  "guardarGlobal",
  "guardar",
  "obtener",
  "pantalla",
  "abrir",
  "leer",
  "existe",
  "sumar",
  "restar",
  "validar",
  "horaActual",
  "minutoActual",
  "esVisible",
  "alClic",
  "alCambio",
]);

export function tokenizeFriendlyScript(source: string): ScriptToken[] {
  const tokens: ScriptToken[] = [];
  let i = 0;

  const push = (text: string, kind: ScriptTokenKind, from: number) => {
    tokens.push({ text, kind, from, to: from + text.length });
  };

  while (i < source.length) {
    const from = i;
    const rest = source.slice(i);

    if (rest.startsWith("//")) {
      const end = source.indexOf("\n", i);
      const slice = end === -1 ? source.slice(i) : source.slice(i, end);
      push(slice, "comment", from);
      i += slice.length;
      continue;
    }

    const strMatch = rest.match(/^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/);
    if (strMatch) {
      push(strMatch[0], "string", from);
      i += strMatch[0].length;
      continue;
    }

    const refMatch = rest.match(/^\$([A-Za-z_][A-Za-z0-9_]*)/);
    if (refMatch) {
      push(refMatch[0], "ref", from);
      i += refMatch[0].length;
      continue;
    }

    const constMatch = rest.match(/^@([A-Za-z_][A-Za-z0-9_]*)/);
    if (constMatch) {
      push(constMatch[0], "const", from);
      i += constMatch[0].length;
      continue;
    }

    const globalMatch = rest.match(/^~([A-Za-z_][A-Za-z0-9_]*)/);
    if (globalMatch) {
      push(globalMatch[0], "global", from);
      i += globalMatch[0].length;
      continue;
    }

    const wordMatch = rest.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    if (wordMatch) {
      const word = wordMatch[0];
      let kind: ScriptTokenKind = "plain";
      if (KEYWORDS.has(word)) kind = "keyword";
      else if (FRIENDLY_FNS.has(word)) kind = "fn";
      else if (word === "ctx") kind = "keyword";
      push(word, kind, from);
      i += word.length;
      continue;
    }

    const numMatch = rest.match(/^\d+(?:\.\d+)?/);
    if (numMatch) {
      push(numMatch[0], "number", from);
      i += numMatch[0].length;
      continue;
    }

    push(source[i], "plain", from);
    i += 1;
  }

  return tokens;
}

export const TOKEN_COLORS: Record<ScriptTokenKind, string> = {
  comment: "#5a6a5a",
  string: "#a8c4a0",
  ref: "#7eb8ff",
  const: "#e8c468",
  global: "#c792ea",
  fn: "#82c995",
  keyword: "#7ec8b8",
  number: "#f0a878",
  plain: "#c8d0c8",
};

export const LINT_ERROR_COLOR = "#f87171";
export const LINT_WARNING_COLOR = "#fbbf24";
