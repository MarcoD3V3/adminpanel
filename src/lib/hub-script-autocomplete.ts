import { GLOBAL_SUGGESTIONS } from "@/lib/hub-script-sugar";
import { getContextualSnippets } from "@/lib/hub-script-snippets-contextual";
import { SIMPLE_SNIPPETS } from "@/lib/hub-script-simple";
import type { HubElementType, HubScriptMode, LogicTrigger } from "@/types/hub-builder";

export type SuggestionKind =
  | "ref"
  | "const"
  | "global"
  | "fn"
  | "ctx"
  | "keyword"
  | "snippet"
  | "screen";

export interface ScriptSuggestion {
  id: string;
  label: string;
  insert: string;
  hint: string;
  kind: SuggestionKind;
  replaceStart: number;
  replaceEnd: number;
}

export interface AutocompleteContext {
  scriptMode: HubScriptMode;
  elementType: HubElementType;
  trigger: LogicTrigger;
  refId?: string;
  refs: { refId: string; label: string }[];
  constants: Record<string, string | number | boolean>;
  screens: { id: string; name: string }[];
}

const CTX_METHODS: { name: string; hint: string; insert?: string }[] = [
  { name: "log", hint: "Escribir en consola", insert: "log(" },
  { name: "toast", hint: "Mostrar aviso", insert: "toast(" },
  { name: "ref", hint: "ID lógico de este elemento" },
  { name: "element", hint: "Datos del elemento actual" },
  { name: "k", hint: "Constante @KEY", insert: 'k("MAX")' },
  { name: "num", hint: "Valor numérico de ref", insert: 'num("ref")' },
  { name: "val", hint: "Valor de ref", insert: 'val("ref")' },
  { name: "g", hint: "Variable global ~", insert: 'g("clave")' },
  { name: "setGlobal", hint: "Guardar global", insert: 'setGlobal("clave", valor)' },
  { name: "getState", hint: "Estado interno", insert: 'getState("key")' },
  { name: "setState", hint: "Estado interno", insert: 'setState("key", valor)' },
  { name: "inc", hint: "Incrementar estado", insert: 'inc("key")' },
  { name: "dec", hint: "Decrementar estado", insert: 'dec("key")' },
  { name: "setValue", hint: "Escribir valor ref", insert: 'setValue("ref", 0)' },
  { name: "setLabel", hint: "Cambiar texto ref", insert: 'setLabel("ref", "texto")' },
  { name: "show", hint: "Mostrar elemento", insert: 'show("ref")' },
  { name: "hide", hint: "Ocultar elemento", insert: 'hide("ref")' },
  { name: "run", hint: "Ejecutar otro script", insert: 'run("ref")' },
  { name: "exists", hint: "¿Existe ref?", insert: 'exists("ref")' },
  { name: "assert", hint: "Validar o error", insert: 'assert(cond, "msg")' },
  { name: "setScreen", hint: "Abrir ventana", insert: 'setScreen("screen-id")' },
  { name: "screen", hint: "ID ventana actual" },
  { name: "wait", hint: "Esperar ms", insert: "wait(500)" },
  { name: "random", hint: "Número aleatorio", insert: "random(1, 10)" },
  { name: "api", hint: "Llamar URL", insert: 'api("https://...")' },
  { name: "on", hint: "Si/sino async", insert: "on(cond, () => {}, () => {})" },
];

const SIMPLE_FNS: { name: string; hint: string; insert: string }[] = [
  { name: "avisa", hint: "Mostrar aviso (toast)", insert: 'avisa("mensaje");' },
  { name: "alert", hint: "Igual que avisa()", insert: 'alert("mensaje");' },
  { name: "abrir", hint: "Abrir ventana", insert: 'abrir("screen-play");' },
  { name: "mostrar", hint: "Mostrar elemento", insert: 'mostrar("ref");' },
  { name: "ocultar", hint: "Ocultar elemento", insert: 'ocultar("ref");' },
  { name: "sumar", hint: "+N al ref y actualiza", insert: "sumar($ref, 1);" },
  { name: "restar", hint: "-N al ref", insert: "restar($ref, 1);" },
  { name: "poner", hint: "Escribir valor", insert: "poner($ref, 0);" },
  { name: "ponerTexto", hint: "Cambiar etiqueta", insert: 'ponerTexto($ref, "texto");' },
  { name: "leer", hint: "Leer valor ref", insert: "leer($ref)" },
  { name: "guardar", hint: "Global persistente", insert: 'guardar("clave", valor);' },
  { name: "obtener", hint: "Leer global", insert: 'obtener("clave")' },
  { name: "validar", hint: "Assert amigable", insert: 'validar(cond, "mensaje");' },
  { name: "ejecutar", hint: "Otro script", insert: 'await ejecutar("ref");' },
  { name: "esperar", hint: "Pausa ms", insert: "await esperar(500);" },
  { name: "horaActual", hint: "Hora 0-23", insert: "horaActual()" },
  { name: "esVisible", hint: "¿Elemento visible?", insert: 'esVisible("ref")' },
  { name: "alClic", hint: "Bloque al clic", insert: "alClic(function() {\n  \n});" },
];

const HUB_FNS: { name: string; hint: string; insert: string }[] = [
  { name: "avisa", hint: "Toast", insert: 'avisa("msg");' },
  { name: "mostrar", hint: "Visible", insert: 'mostrar("ref");' },
  { name: "ocultar", hint: "Oculto", insert: 'ocultar("ref");' },
  { name: "alternar", hint: "Toggle visible", insert: 'alternar("ref");' },
  { name: "set", hint: "Valor numérico", insert: 'set("ref", 0);' },
  { name: "label", hint: "Texto ref", insert: 'label("ref", "texto");' },
  { name: "ejecutar", hint: "Run script", insert: 'await ejecutar("ref");' },
  { name: "pantalla", hint: "Abrir ventana", insert: 'pantalla("screen-play");' },
  { name: "guardarGlobal", hint: "Variable global", insert: 'guardarGlobal("key", val);' },
  { name: "esperar", hint: "Wait ms", insert: "await esperar(300);" },
  { name: "aleatorio", hint: "Random int", insert: "aleatorio(1, 6)" },
  { name: "leer", hint: "Leer ref", insert: 'leer("ref")' },
  { name: "existe", hint: "Ref existe", insert: 'existe("ref")' },
  { name: "log", hint: "Consola", insert: 'log("debug");' },
];

const KEYWORDS_SIMPLE = [
  { name: "si", hint: "Condición", insert: "si (cond) {\n  \n}" },
  { name: "sino", hint: "Else", insert: "sino {\n  \n}" },
  { name: "fin", hint: "Cerrar bloque", insert: "}" },
];

const KEYWORDS_HUB = [
  { name: "if", hint: "Condición", insert: "if (cond) {\n  \n}" },
  { name: "else", hint: "Sino", insert: "else {\n  \n}" },
  { name: "const", hint: "Constante local", insert: "const x = " },
  { name: "await", hint: "Async wait", insert: "await " },
];

function matchesPrefix(text: string, prefix: string): boolean {
  return text.toLowerCase().startsWith(prefix.toLowerCase());
}

function wordBeforeCursor(before: string): { word: string; start: number } | null {
  const m = before.match(/(?:^|[\s(,;+\-*/=!&|{])([A-Za-z_$@~.]*)$/);
  if (!m) return null;
  const word = m[1];
  return { word, start: before.length - word.length };
}

function addRefSuggestions(
  out: ScriptSuggestion[],
  ctx: AutocompleteContext,
  prefix: string,
  replaceStart: number,
  replaceEnd: number,
  style: "$" | "refs."
) {
  for (const r of ctx.refs) {
    if (prefix && !matchesPrefix(r.refId, prefix)) continue;
    const insert = style === "$" ? `$${r.refId}` : `refs.${r.refId}`;
    out.push({
      id: `ref-${style}-${r.refId}`,
      label: insert,
      insert,
      hint: r.label || "Elemento en pantalla",
      kind: "ref",
      replaceStart,
      replaceEnd,
    });
  }
}

function addConstSuggestions(
  out: ScriptSuggestion[],
  ctx: AutocompleteContext,
  prefix: string,
  replaceStart: number,
  replaceEnd: number,
  style: "@" | "constantes."
) {
  for (const key of Object.keys(ctx.constants)) {
    if (prefix && !matchesPrefix(key, prefix)) continue;
    const insert = style === "@" ? `@${key}` : `constantes.${key}`;
    out.push({
      id: `const-${key}`,
      label: insert,
      insert,
      hint: `Constante = ${JSON.stringify(ctx.constants[key])}`,
      kind: "const",
      replaceStart,
      replaceEnd,
    });
  }
}

function addGlobalSuggestions(
  out: ScriptSuggestion[],
  prefix: string,
  replaceStart: number,
  replaceEnd: number,
  style: "~" | "global."
) {
  const keys = [...new Set([...GLOBAL_SUGGESTIONS, "visitas", "premios", "lastInput", "fase", "ultimoAccion"])];
  for (const key of keys) {
    if (prefix && !matchesPrefix(key, prefix)) continue;
    const insert = style === "~" ? `~${key}` : `global.${key}`;
    out.push({
      id: `global-${key}`,
      label: insert,
      insert,
      hint: "Variable global del launcher",
      kind: "global",
      replaceStart,
      replaceEnd,
    });
  }
}

function addFnSuggestions(
  out: ScriptSuggestion[],
  items: { name: string; hint: string; insert: string }[],
  prefix: string,
  replaceStart: number,
  replaceEnd: number
) {
  for (const fn of items) {
    if (prefix && !matchesPrefix(fn.name, prefix)) continue;
    out.push({
      id: `fn-${fn.name}`,
      label: fn.name,
      insert: fn.insert,
      hint: fn.hint,
      kind: "fn",
      replaceStart,
      replaceEnd,
    });
  }
}

function addKeywordSuggestions(
  out: ScriptSuggestion[],
  items: { name: string; hint: string; insert: string }[],
  prefix: string,
  replaceStart: number,
  replaceEnd: number
) {
  for (const kw of items) {
    if (prefix && !matchesPrefix(kw.name, prefix)) continue;
    out.push({
      id: `kw-${kw.name}`,
      label: kw.name,
      insert: kw.insert,
      hint: kw.hint,
      kind: "keyword",
      replaceStart,
      replaceEnd,
    });
  }
}

function addSnippetSuggestions(out: ScriptSuggestion[], ctx: AutocompleteContext, prefix: string) {
  const snippets = [
    ...SIMPLE_SNIPPETS.map((s) => ({ label: s.label, code: s.code, hint: s.hint })),
    ...(ctx.scriptMode === "hub"
      ? getContextualSnippets({
          elementType: ctx.elementType,
          trigger: ctx.trigger,
          refId: ctx.refId,
        }).map((s) => ({ label: s.label, code: s.code, hint: s.hint }))
      : []),
  ];

  for (const s of snippets) {
    if (prefix && !matchesPrefix(s.label, prefix)) continue;
    out.push({
      id: `snip-${s.label}`,
      label: `↳ ${s.label}`,
      insert: s.code,
      hint: s.hint,
      kind: "snippet",
      replaceStart: -1,
      replaceEnd: -1,
    });
  }
}

function addScreenSuggestions(
  out: ScriptSuggestion[],
  ctx: AutocompleteContext,
  prefix: string,
  replaceStart: number,
  replaceEnd: number
) {
  for (const s of ctx.screens) {
    if (prefix && !matchesPrefix(s.id, prefix) && !matchesPrefix(s.name, prefix)) continue;
    out.push({
      id: `screen-${s.id}`,
      label: s.id,
      insert: `"${s.id}"`,
      hint: s.name,
      kind: "screen",
      replaceStart,
      replaceEnd,
    });
  }
}

/** Detecta sugerencias en la posición del cursor */
export function detectScriptSuggestions(
  text: string,
  cursor: number,
  ctx: AutocompleteContext,
  forceAll = false
): ScriptSuggestion[] {
  const before = text.slice(0, cursor);
  const out: ScriptSuggestion[] = [];

  const ctxMatch = before.match(/ctx\.([A-Za-z0-9_]*)$/);
  if (ctxMatch) {
    const prefix = ctxMatch[1];
    const start = cursor - prefix.length - 4;
    for (const m of CTX_METHODS) {
      if (prefix && !matchesPrefix(m.name, prefix)) continue;
      out.push({
        id: `ctx-${m.name}`,
        label: `ctx.${m.name}`,
        insert: m.insert ?? `ctx.${m.name}`,
        hint: m.hint,
        kind: "ctx",
        replaceStart: start,
        replaceEnd: cursor,
      });
    }
    return out.slice(0, 20);
  }

  const refsMatch = before.match(/refs\.([A-Za-z0-9_]*)$/);
  if (refsMatch) {
    addRefSuggestions(out, ctx, refsMatch[1], cursor - refsMatch[1].length - 5, cursor, "refs.");
    return out.slice(0, 20);
  }

  const constObjMatch = before.match(/constantes\.([A-Za-z0-9_]*)$/);
  if (constObjMatch) {
    addConstSuggestions(out, ctx, constObjMatch[1], cursor - constObjMatch[1].length - 12, cursor, "constantes.");
    return out.slice(0, 20);
  }

  const globalObjMatch = before.match(/global\.([A-Za-z0-9_]*)$/);
  if (globalObjMatch) {
    addGlobalSuggestions(out, globalObjMatch[1], cursor - globalObjMatch[1].length - 7, cursor, "global.");
    return out.slice(0, 20);
  }

  const refMatch = before.match(/\$([A-Za-z0-9_]*)$/);
  if (refMatch) {
    addRefSuggestions(out, ctx, refMatch[1], cursor - refMatch[1].length - 1, cursor, "$");
    return out.slice(0, 20);
  }

  const constMatch = before.match(/@([A-Za-z0-9_]*)$/);
  if (constMatch) {
    addConstSuggestions(out, ctx, constMatch[1], cursor - constMatch[1].length - 1, cursor, "@");
    return out.slice(0, 20);
  }

  const globalMatch = before.match(/~([A-Za-z0-9_]*)$/);
  if (globalMatch) {
    addGlobalSuggestions(out, globalMatch[1], cursor - globalMatch[1].length - 1, cursor, "~");
    return out.slice(0, 20);
  }

  const stringFnMatch = before.match(/(?:abrir|pantalla|setScreen)\s*\(\s*("(?:[^"\\]|\\.)*)$/);
  if (stringFnMatch) {
    const partial = stringFnMatch[1].slice(1);
    addScreenSuggestions(out, ctx, partial, cursor - partial.length, cursor);
    if (out.length) return out.slice(0, 15);
  }

  const wordInfo = wordBeforeCursor(before);
  const prefix = wordInfo?.word ?? "";
  const replaceStart = wordInfo?.start ?? cursor;
  const replaceEnd = cursor;

  if (prefix.length >= 1 || forceAll) {
    const isSimple = ctx.scriptMode === "simple";

    addFnSuggestions(out, isSimple ? SIMPLE_FNS : HUB_FNS, prefix, replaceStart, replaceEnd);
    addKeywordSuggestions(out, isSimple ? KEYWORDS_SIMPLE : KEYWORDS_HUB, prefix, replaceStart, replaceEnd);

    if (prefix.startsWith("ctx") || forceAll) {
      for (const m of CTX_METHODS) {
        if (!forceAll && prefix !== "ctx" && !matchesPrefix(`ctx.${m.name}`, prefix)) continue;
        out.push({
          id: `ctx-all-${m.name}`,
          label: `ctx.${m.name}`,
          insert: m.insert ?? `ctx.${m.name}`,
          hint: m.hint,
          kind: "ctx",
          replaceStart,
          replaceEnd,
        });
      }
    }

    addSnippetSuggestions(out, ctx, prefix);

    if (forceAll || prefix.length === 0) {
      addRefSuggestions(out, ctx, "", replaceStart, replaceEnd, isSimple ? "refs." : "$");
      addConstSuggestions(out, ctx, "", replaceStart, replaceEnd, isSimple ? "constantes." : "@");
      addGlobalSuggestions(out, "", replaceStart, replaceEnd, isSimple ? "global." : "~");
      addScreenSuggestions(out, ctx, "", replaceStart, replaceEnd);
    }
  }

  const seen = new Set<string>();
  return out
    .filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    })
    .slice(0, 24);
}

export const SUGGESTION_KIND_LABELS: Record<SuggestionKind, string> = {
  ref: "Ref",
  const: "Const",
  global: "Global",
  fn: "Función",
  ctx: "ctx",
  keyword: "Palabra",
  snippet: "Plantilla",
  screen: "Ventana",
};

export const SUGGESTION_KIND_COLORS: Record<SuggestionKind, string> = {
  ref: "#7eb8ff",
  const: "#e8c468",
  global: "#c792ea",
  fn: "#82c995",
  ctx: "#7ec8b8",
  keyword: "#7ec8b8",
  snippet: "#f0a878",
  screen: "#a8c4a0",
};
