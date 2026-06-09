/** Datos y generadores del asistente visual HubScript */

export const COMPARE_OPS = [
  { value: "==", label: "= igual a" },
  { value: "!=", label: "≠ distinto de" },
  { value: ">=", label: "≥ mayor o igual" },
  { value: ">", label: "> mayor que" },
  { value: "<=", label: "≤ menor o igual" },
  { value: "<", label: "< menor que" },
] as const;

export type CompareOp = (typeof COMPARE_OPS)[number]["value"];

export type ValueSource = "const" | "number" | "ref" | "global" | "text" | "bool";

export type LeftSource = "ref" | "global" | "visible";

export type ThenAction =
  | "avisa"
  | "mostrar"
  | "ocultar"
  | "alternar"
  | "ejecutar"
  | "valor"
  | "texto"
  | "global"
  | "pantalla"
  | "nada";

export const WIZARD_MODES = [
  { value: "si_entonces", label: "Si se cumple → hacer algo", group: "Condiciones" },
  { value: "si_sino", label: "Si se cumple → sino otra cosa", group: "Condiciones" },
  { value: "elemento", label: "Acción directa en un elemento", group: "Elementos" },
  { value: "contador", label: "Sumar al contador", group: "Números" },
  { value: "global", label: "Leer o guardar variable global", group: "Números" },
  { value: "visita", label: "Contar visitas (+1)", group: "Números" },
  { value: "esperar", label: "Esperar y luego actuar", group: "Tiempo" },
  { value: "aleatorio", label: "Número aleatorio", group: "Extra" },
  { value: "pantalla", label: "Ir a otra pantalla", group: "Extra" },
  { value: "validar", label: "Comprobar o bloquear si falla", group: "Condiciones" },
] as const;

export type WizardMode = (typeof WIZARD_MODES)[number]["value"];

export const THEN_ACTIONS: { value: ThenAction; label: string; needsRef?: boolean; needsText?: boolean; needsGlobal?: boolean }[] = [
  { value: "avisa", label: "Mostrar aviso (toast)" },
  { value: "mostrar", label: "Mostrar elemento", needsRef: true },
  { value: "ocultar", label: "Ocultar elemento", needsRef: true },
  { value: "alternar", label: "Alternar visible / oculto", needsRef: true },
  { value: "ejecutar", label: "Ejecutar otro script", needsRef: true },
  { value: "valor", label: "Escribir valor numérico", needsRef: true, needsText: true },
  { value: "texto", label: "Cambiar etiqueta / texto", needsRef: true, needsText: true },
  { value: "global", label: "Guardar en variable global", needsGlobal: true, needsText: true },
  { value: "pantalla", label: "Ir a pantalla", needsText: true },
  { value: "nada", label: "Solo comprobar (sin acción)" },
];

export const ELEMENT_DIRECT_ACTIONS = [
  { value: "mostrar", label: "Mostrar" },
  { value: "ocultar", label: "Ocultar" },
  { value: "alternar", label: "Alternar visible" },
  { value: "ejecutar", label: "Ejecutar su script" },
  { value: "valor", label: "Poner valor numérico" },
  { value: "texto", label: "Cambiar texto" },
] as const;

export type ElementDirectAction = (typeof ELEMENT_DIRECT_ACTIONS)[number]["value"];

export type GlobalMode = "leer" | "sumar" | "guardar";

function esc(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function renderRight(
  source: ValueSource,
  constKey: string,
  numVal: string,
  refB: string,
  globalKey: string,
  textVal: string,
  boolVal: boolean
): string {
  switch (source) {
    case "const":
      return `@${constKey} ?? ${numVal || "0"}`;
    case "number":
      return numVal || "0";
    case "ref":
      return `$${refB}`;
    case "global":
      return `~${globalKey}`;
    case "text":
      return `"${esc(textVal)}"`;
    case "bool":
      return boolVal ? "true" : "false";
    default:
      return "0";
  }
}

function renderLeft(source: LeftSource, refA: string, globalKey: string): string {
  switch (source) {
    case "ref":
      return `$${refA}`;
    case "global":
      return `~${globalKey}`;
    case "visible":
      return "ctx.element.visible";
    default:
      return `$${refA}`;
  }
}

export function renderThenAction(
  action: ThenAction,
  targetRef: string,
  message: string,
  globalKey: string,
  screenId: string
): string {
  switch (action) {
    case "avisa":
      return `avisa("${esc(message || "Hecho")}");`;
    case "mostrar":
      return `mostrar("${esc(targetRef)}");`;
    case "ocultar":
      return `ocultar("${esc(targetRef)}");`;
    case "alternar":
      return `alternar("${esc(targetRef)}");`;
    case "ejecutar":
      return `await ejecutar("${esc(targetRef)}");`;
    case "valor":
      return `set("${esc(targetRef)}", ${message || "0"});`;
    case "texto":
      return `label("${esc(targetRef)}", "${esc(message || "Texto")}");`;
    case "global":
      return `guardarGlobal("${esc(globalKey || "dato")}", ${message || "0"});`;
    case "pantalla":
      return `pantalla("${esc(screenId || message || "screen-play")}");`;
    case "nada":
      return "// condición cumplida";
    default:
      return "";
  }
}

export interface WizardBuildInput {
  mode: WizardMode;
  leftSource: LeftSource;
  refA: string;
  leftGlobal: string;
  op: CompareOp;
  rightSource: ValueSource;
  constKey: string;
  numVal: string;
  refB: string;
  rightGlobal: string;
  textVal: string;
  boolVal: boolean;
  thenAction: ThenAction;
  elseAction: ThenAction;
  targetRef: string;
  message: string;
  globalKey: string;
  screenId: string;
  step: string;
  waitMs: string;
  randomMin: string;
  randomMax: string;
  elementAction: ElementDirectAction;
  elementValue: string;
  globalMode: GlobalMode;
  globalDelta: string;
}

function renderVisibleCondition(visible: boolean): string {
  return visible ? "ctx.element.visible" : "!ctx.element.visible";
}

export function buildWizardScript(input: WizardBuildInput): string {
  const {
    mode,
    leftSource,
    refA,
    leftGlobal,
    op,
    rightSource,
    constKey,
    numVal,
    refB,
    rightGlobal,
    textVal,
    boolVal,
    thenAction,
    elseAction,
    targetRef,
    message,
    globalKey,
    screenId,
    step,
    waitMs,
    randomMin,
    randomMax,
    elementAction,
    elementValue,
    globalMode,
    globalDelta,
  } = input;

  switch (mode) {
    case "si_entonces": {
      const cond =
        leftSource === "visible"
          ? renderVisibleCondition(boolVal)
          : `${renderLeft(leftSource, refA, leftGlobal)} ${op} ${renderRight(rightSource, constKey, numVal, refB, rightGlobal, textVal, boolVal)}`;
      const body = renderThenAction(thenAction, targetRef, message, globalKey, screenId);
      return `if (${cond}) {\n  ${body}\n}`;
    }
    case "si_sino": {
      const cond =
        leftSource === "visible"
          ? renderVisibleCondition(boolVal)
          : `${renderLeft(leftSource, refA, leftGlobal)} ${op} ${renderRight(rightSource, constKey, numVal, refB, rightGlobal, textVal, boolVal)}`;
      const thenBody = renderThenAction(thenAction, targetRef, message, globalKey, screenId);
      const elseBody = renderThenAction(elseAction, targetRef, message, globalKey, screenId);
      return `if (${cond}) {\n  ${thenBody}\n} else {\n  ${elseBody}\n}`;
    }
    case "elemento": {
      const ref = targetRef || refA;
      switch (elementAction) {
        case "mostrar":
          return `mostrar("${esc(ref)}");`;
        case "ocultar":
          return `ocultar("${esc(ref)}");`;
        case "alternar":
          return `alternar("${esc(ref)}");`;
        case "ejecutar":
          return `await ejecutar("${esc(ref)}");`;
        case "valor":
          return `set("${esc(ref)}", ${elementValue || "0"});`;
        case "texto":
          return `label("${esc(ref)}", "${esc(elementValue || "Nuevo texto")}");`;
        default:
          return "";
      }
    }
    case "contador": {
      const s = step || "1";
      return `const n = ctx.inc("count", ${s});\nctx.updateElement({ label: String(n), value: n });`;
    }
    case "global": {
      const g = globalKey || "visitas";
      switch (globalMode) {
        case "leer":
          return `const dato = ctx.toNumber(~${g}, 0);\navisa("Global ${g}: " + dato);`;
        case "sumar":
          return `const n = ctx.toNumber(~${g}, 0) + ${globalDelta || "1"};\nguardarGlobal("${esc(g)}", n);`;
        case "guardar":
          return `guardarGlobal("${esc(g)}", ${elementValue || numVal || "0"});`;
        default:
          return "";
      }
    }
    case "visita":
      return `const v = ctx.toNumber(~visitas, 0) + 1;\nguardarGlobal("visitas", v);\navisa("Visita #" + v);`;
    case "esperar": {
      const ms = waitMs || "500";
      const after = renderThenAction(thenAction, targetRef, message, globalKey, screenId);
      return `await esperar(${ms});\n${after}`;
    }
    case "aleatorio": {
      const a = randomMin || "1";
      const b = randomMax || "6";
      return `const dado = aleatorio(${a}, ${b});\nguardarGlobal("lastRoll", dado);\navisa("Salió: " + dado);`;
    }
    case "pantalla":
      return `pantalla("${esc(screenId || "screen-play")}");`;
    case "validar": {
      const cond =
        leftSource === "visible"
          ? renderVisibleCondition(boolVal)
          : `${renderLeft(leftSource, refA, leftGlobal)} ${op} ${renderRight(rightSource, constKey, numVal, refB, rightGlobal, textVal, boolVal)}`;
      return `ctx.assert(${cond}, "${esc(message || "Validación fallida")}");`;
    }
    default:
      return "";
  }
}

export function wizardModeOptions() {
  const groups = [...new Set(WIZARD_MODES.map((m) => m.group))];
  return groups.flatMap((group) => {
    const items = WIZARD_MODES.filter((m) => m.group === group);
    return items.map((m) => ({ value: m.value, label: `${m.label}` }));
  });
}
