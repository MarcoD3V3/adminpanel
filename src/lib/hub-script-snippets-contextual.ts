import type { HubElementType, LogicTrigger } from "@/types/hub-builder";
import { SCRIPT_SNIPPETS } from "@/lib/hub-script-sugar";

export interface ContextualSnippet {
  label: string;
  code: string;
  hint: string;
  group: string;
  /** Tipos de elemento; vacío = todos */
  types?: HubElementType[];
  /** Disparadores sugeridos; vacío = cualquiera */
  triggers?: LogicTrigger[];
  /** Prioridad en la lista (mayor = más arriba) */
  priority?: number;
}

const CLICKABLE_TYPES: HubElementType[] = [
  "play-button",
  "button",
  "nav-item",
  "script-button",
  "icon-button",
  "link",
  "banner",
  "news-card",
  "modpack-slot",
  "toast-trigger",
  "api-call",
  "counter",
  "timer",
  "profile-widget",
];

const INPUT_TYPES: HubElementType[] = ["input-field"];
const TOGGLE_TYPES: HubElementType[] = ["toggle", "checkbox"];
const RANGE_TYPES: HubElementType[] = ["slider", "progress-bar"];
const SELECT_TYPES: HubElementType[] = [
  "dropdown",
  "version-selector",
  "instance-selector",
  "installed-version-selector",
];

export const CONTEXTUAL_SNIPPETS: ContextualSnippet[] = [
  // ── Botones / clic ──────────────────────────────────────────
  {
    label: "Contar clics",
    hint: "Suma 1 por cada clic y muestra total",
    group: "Clic",
    types: CLICKABLE_TYPES,
    triggers: ["click"],
    priority: 90,
    code: `const clics = ctx.inc("clics");
label(ctx.ref, "Clics: " + clics);
ctx.log("Total clics:", clics);`,
  },
  {
    label: "Doble clic",
    hint: "Detecta 2 clics seguidos (<400ms)",
    group: "Clic",
    types: CLICKABLE_TYPES,
    triggers: ["click"],
    priority: 95,
    code: `const ahora = ctx.now();
const prev = ctx.toNumber(ctx.getState("_ultimoClic"), 0);
ctx.setState("_ultimoClic", ahora);

if (prev && ahora - prev < 400) {
  ctx.setState("_ultimoClic", 0);
  avisa("¡Doble clic!");
} else {
  ctx.log("Clic simple — pulsa otra vez rápido");
}`,
  },
  {
    label: "Triple clic",
    hint: "3 clics rápidos activan acción especial",
    group: "Clic",
    types: CLICKABLE_TYPES,
    triggers: ["click"],
    priority: 88,
    code: `const t = ctx.now();
const cadena = ctx.toNumber(ctx.getState("_cadenaClic"), 0);
const ultimo = ctx.toNumber(ctx.getState("_tClic"), 0);

if (t - ultimo < 500) {
  const n = cadena + 1;
  ctx.setState("_cadenaClic", n);
  if (n >= 3) {
    ctx.setState("_cadenaClic", 0);
    avisa("¡Combo triple!");
    await ejecutar("bonusRef");
  }
} else {
  ctx.setState("_cadenaClic", 1);
}
ctx.setState("_tClic", t);`,
  },
  {
    label: "N clics → premio",
    hint: "Al llegar a @META clics, recompensa y reset",
    group: "Clic",
    types: CLICKABLE_TYPES,
    triggers: ["click"],
    priority: 85,
    code: `const meta = @META ?? 5;
const n = ctx.inc("clicsPremio");

if (n >= meta) {
  ctx.setState("clicsPremio", 0);
  avisa(@MSG ?? "¡Meta de clics!");
  guardarGlobal("premios", ctx.toNumber(~premios, 0) + 1);
} else {
  label(ctx.ref, n + "/" + meta);
}`,
  },
  {
    label: "Cooldown",
    hint: "Ignora clics durante @MS ms (anti-spam)",
    group: "Clic",
    types: CLICKABLE_TYPES,
    triggers: ["click"],
    priority: 80,
    code: `const ms = @MS ?? 800;
const ultimo = ctx.toNumber(ctx.getState("_cooldown"), 0);
const ahora = ctx.now();

if (ultimo && ahora - ultimo < ms) {
  avisa(@MSG ?? "Espera un momento…");
  return;
}

ctx.setState("_cooldown", ahora);
// — acción principal aquí —
avisa("OK");`,
  },
  {
    label: "Clic → ventana",
    hint: "Abre otra pantalla al pulsar",
    group: "Clic",
    types: CLICKABLE_TYPES,
    triggers: ["click"],
    priority: 75,
    code: `pantalla(@PANTALLA ?? "screen-play");
avisa(@MSG ?? "Cambiando pantalla…");`,
  },
  {
    label: "Clic → cadena",
    hint: "Ejecuta varios scripts en orden",
    group: "Clic",
    types: CLICKABLE_TYPES,
    triggers: ["click"],
    priority: 70,
    code: `await ejecutar("paso1");
await esperar(@PAUSA ?? 200);
await ejecutar("paso2");
avisa("Secuencia completa");`,
  },
  {
    label: "Alternar modo",
    hint: "Cada clic cambia entre 2 estados",
    group: "Clic",
    types: CLICKABLE_TYPES,
    triggers: ["click"],
    priority: 65,
    code: `const on = !Boolean(ctx.getState("modoOn"));
ctx.setState("modoOn", on);

if (on) {
  label(ctx.ref, @ON ?? "Modo ON");
  mostrar("panelExtra");
} else {
  label(ctx.ref, @OFF ?? "Modo OFF");
  ocultar("panelExtra");
}`,
  },

  // ── Input ───────────────────────────────────────────────────
  {
    label: "No vacío",
    hint: "Valida que el input tenga texto",
    group: "Input",
    types: INPUT_TYPES,
    triggers: ["change", "submit", "click"],
    priority: 90,
    code: `const txt = String(ctx.element.value ?? "").trim();
ctx.assert(!ctx.isEmpty(txt), @MSG ?? "Escribe algo");
guardarGlobal("lastInput", txt);`,
  },
  {
    label: "Mín. caracteres",
    hint: "Longitud >= @MIN_LEN",
    group: "Input",
    types: INPUT_TYPES,
    triggers: ["change", "submit"],
    priority: 88,
    code: `const min = @MIN_LEN ?? 3;
const txt = String(ctx.element.value ?? "").trim();

ctx.verify(txt.length >= min, "OK", "Mínimo " + min + " caracteres");
guardarGlobal("lastInput", txt);`,
  },
  {
    label: "Contiene",
    hint: "Busca @PALABRA en el texto",
    group: "Input",
    types: INPUT_TYPES,
    triggers: ["change", "submit"],
    priority: 85,
    code: `const buscar = String(@PALABRA ?? "minecraft").toLowerCase();
const txt = String(ctx.element.value ?? "").toLowerCase();

if (txt.includes(buscar)) {
  avisa(@OK ?? "¡Encontrado!");
} else {
  avisa(@FAIL ?? "No contiene: " + buscar);
}`,
  },
  {
    label: "Al escribir → ref",
    hint: "Copia valor a otro elemento",
    group: "Input",
    types: INPUT_TYPES,
    triggers: ["change"],
    priority: 82,
    code: `const txt = String(ctx.element.value ?? "");
label(@DEST ?? "titulo", txt || "…");
set(@DEST ?? "titulo", txt.length);`,
  },
  {
    label: "Enter / submit",
    hint: "Validar y actuar al confirmar",
    group: "Input",
    types: INPUT_TYPES,
    triggers: ["submit", "click"],
    priority: 80,
    code: `const txt = String(ctx.element.value ?? "").trim();
ctx.assert(txt.length >= (@MIN ?? 1), "Campo requerido");

guardarGlobal("lastInput", txt);
avisa("Guardado: " + txt);
await ejecutar(@SIGUIENTE ?? "btnConfirmar");`,
  },
  {
    label: "Mostrar si escribe",
    hint: "Revela botón cuando hay texto",
    group: "Input",
    types: INPUT_TYPES,
    triggers: ["change"],
    priority: 78,
    code: `const ok = String(ctx.element.value ?? "").trim().length >= (@MIN ?? 1);

if (ok) mostrar(@BOTON ?? "btnJugar");
else ocultar(@BOTON ?? "btnJugar");`,
  },

  // ── Toggle / Checkbox ───────────────────────────────────────
  {
    label: "Si activado",
    hint: "Acción solo cuando está ON",
    group: "Toggle",
    types: TOGGLE_TYPES,
    triggers: ["change", "click"],
    priority: 90,
    code: `const on = Boolean(ctx.element.value);

if (on) {
  avisa(@MSG_ON ?? "Activado");
  guardarGlobal(@KEY ?? "opcionOn", true);
} else {
  avisa(@MSG_OFF ?? "Desactivado");
  guardarGlobal(@KEY ?? "opcionOn", false);
}`,
  },
  {
    label: "Requerido ON",
    hint: "Bloquea si no está marcado",
    group: "Toggle",
    types: TOGGLE_TYPES,
    triggers: ["change", "click", "submit"],
    priority: 88,
    code: `const on = Boolean(ctx.element.value);
ctx.assert(on, @MSG ?? "Debes activar esta opción");`,
  },
  {
    label: "Toggle → mostrar",
    hint: "Muestra/oculta panel según estado",
    group: "Toggle",
    types: TOGGLE_TYPES,
    triggers: ["change"],
    priority: 85,
    code: `const on = Boolean(ctx.element.value);
const panel = @PANEL ?? "panelExtra";

if (on) mostrar(panel);
else ocultar(panel);`,
  },

  // ── Slider / rango ──────────────────────────────────────────
  {
    label: "En rango",
    hint: "Valida entre @MIN y @MAX",
    group: "Rango",
    types: RANGE_TYPES,
    triggers: ["change"],
    priority: 90,
    code: `const v = ctx.toNumber(ctx.element.value, 50);
const min = @MIN ?? 0;
const max = @MAX ?? 100;

ctx.verify(ctx.between(v, min, max), "OK", "Fuera de rango");
label(ctx.ref, String(v) + "%");`,
  },
  {
    label: "Umbral",
    hint: "Si valor >= @UMBRAL → acción",
    group: "Rango",
    types: RANGE_TYPES,
    triggers: ["change"],
    priority: 85,
    code: `const v = ctx.toNumber(ctx.element.value, 0);
const umbral = @UMBRAL ?? 80;

if (v >= umbral) {
  avisa(@MSG ?? "¡Umbral alcanzado!");
  mostrar(@REF ?? "bonusPanel");
} else {
  ocultar(@REF ?? "bonusPanel");
}`,
  },
  {
    label: "Sync barra",
    hint: "Actualiza progress-bar vinculada",
    group: "Rango",
    types: RANGE_TYPES,
    triggers: ["change"],
    priority: 80,
    code: `const v = ctx.toNumber(ctx.element.value, 50);
set(@BARRA ?? "barraProgreso", v);
label(@BARRA ?? "barraProgreso", v + "%");`,
  },

  // ── Select / dropdown ───────────────────────────────────────
  {
    label: "Opción elegida",
    hint: "Reacciona al valor seleccionado",
    group: "Select",
    types: SELECT_TYPES,
    triggers: ["change"],
    priority: 90,
    code: `const pick = String(ctx.element.value ?? "");
guardarGlobal("selectedOption", pick);
avisa("Elegiste: " + pick);`,
  },
  {
    label: "Si opción = X",
    hint: "Rama según valor exacto",
    group: "Select",
    types: SELECT_TYPES,
    triggers: ["change"],
    priority: 88,
    code: `const pick = String(ctx.element.value ?? "");
const esperada = String(@OPCION ?? "1.21.4");

if (pick === esperada) {
  avisa(@OK ?? "Versión correcta");
} else {
  avisa(@WARN ?? "Versión distinta: " + pick);
}`,
  },

  // ── Contador / timer ────────────────────────────────────────
  {
    label: "Tick +1",
    hint: "Ideal con disparador interval",
    group: "Contador",
    types: ["counter", "timer"],
    triggers: ["interval", "click"],
    priority: 90,
    code: `const max = @MAX ?? 60;
let t = ctx.toNumber(ctx.element.value, 0) + 1;

if (t > max) t = 0;
ctx.updateElement({ value: t, label: String(t).padStart(2, "0") });`,
  },
  {
    label: "Al llegar a MAX",
    hint: "Reset o acción al límite",
    group: "Contador",
    types: ["counter", "timer"],
    triggers: ["interval", "click"],
    priority: 85,
    code: `const max = @MAX ?? 10;
const n = ctx.inc("ticks");

if (n >= max) {
  ctx.setState("ticks", 0);
  avisa(@MSG ?? "¡Tiempo!");
  await ejecutar(@REF ?? "alarmRef");
}`,
  },

  // ── API ─────────────────────────────────────────────────────
  {
    label: "API + status",
    hint: "Llama URL y verifica respuesta",
    group: "API",
    types: ["api-call"],
    triggers: ["click"],
    priority: 90,
    code: `const url = String(@API_URL ?? ctx.element.logic?.apiUrl ?? "");
ctx.assert(url, "Define API_URL");

const res = await ctx.api(url, { method: @METHOD ?? "GET" });
ctx.verify(res.status === 200, "API OK", "Error " + res.status);
avisa(@MSG ?? "Respuesta OK");`,
  },
  {
    label: "API retry",
    hint: "Reintenta hasta @INTENTOS veces",
    group: "API",
    types: ["api-call"],
    triggers: ["click"],
    priority: 85,
    code: `const url = String(@API_URL ?? "");
const max = @INTENTOS ?? 3;
let ok = false;

for (let i = 1; i <= max; i++) {
  const res = await ctx.api(url, { method: "GET" });
  if (res.status === 200) { ok = true; break; }
  await esperar(300 * i);
}

ctx.assert(ok, "API falló tras " + max + " intentos");
avisa("Conectado");`,
  },

  // ── Carga / intervalo (cualquier tipo) ──────────────────────
  {
    label: "Al cargar",
    hint: "Disparador load — init pantalla",
    group: "Ciclo",
    triggers: ["load"],
    priority: 90,
    code: `ctx.log("Pantalla:", ctx.screen());
guardarGlobal("ultimaVisita", ctx.today());

if (~visitas) {
  guardarGlobal("visitas", ctx.toNumber(~visitas, 0) + 1);
} else {
  guardarGlobal("visitas", 1);
}`,
  },
  {
    label: "Polling",
    hint: "Cada interval — revisar condición",
    group: "Ciclo",
    triggers: ["interval"],
    priority: 88,
    code: `const cada = @INTERVAL_MS ?? 1000;
// Disparador interval ya controla el tiempo
const v = ctx.toNumber(~sensor, 0);

if (v >= (@UMBRAL ?? 100)) {
  avisa(@ALERTA ?? "Umbral superado");
  await ejecutar(@REF ?? "handler");
}`,
  },

  // ── Combinaciones grandes ───────────────────────────────────
  {
    label: "AND multi-ref",
    hint: "Varias condiciones a la vez",
    group: "Combo",
    priority: 70,
    code: `const a = ctx.toNumber($refA, 0) >= (@MIN_A ?? 1);
const b = Boolean($refB);
const c = String(leer(@REF_C ?? "input1") ?? "").length >= (@MIN_C ?? 3);

if (ctx.and(a, b, c)) {
  avisa(@OK ?? "¡Todo listo!");
  mostrar(@BOTON ?? "btnJugar");
} else {
  ocultar(@BOTON ?? "btnJugar");
}`,
  },
  {
    label: "OR alternativas",
    hint: "Si cualquiera cumple → acción",
    group: "Combo",
    priority: 68,
    code: `const vip = Boolean(~premium);
const clics = ctx.toNumber(ctx.getState("clics"), 0) >= (@CLIKS ?? 10);
const codigo = String(ctx.element.value ?? "") === String(@CODIGO ?? "VIP2024");

if (ctx.or(vip, clics, codigo)) {
  avisa("Acceso desbloqueado");
  abrir(@PANTALLA ?? "screen-play");
}`,
  },
  {
    label: "Máquina estados",
    hint: "Flujo intro → juego → fin",
    group: "Combo",
    priority: 65,
    code: `const fase = String(~fase ?? "intro");

if (fase === "intro") {
  guardarGlobal("fase", "juego");
  pantalla("screen-play");
} else if (fase === "juego") {
  guardarGlobal("fase", "fin");
  avisa("¡Sesión terminada!");
} else {
  guardarGlobal("fase", "intro");
  pantalla("screen-home");
}`,
  },
  {
    label: "Debounce",
    hint: "Espera quietud antes de actuar (change)",
    group: "Combo",
    types: INPUT_TYPES,
    triggers: ["change"],
    priority: 60,
    code: `const espera = @MS ?? 400;
const token = ctx.now();
ctx.setState("_debounceToken", token);

await esperar(espera);

if (ctx.getState("_debounceToken") !== token) return;

const txt = String(ctx.element.value ?? "").trim();
guardarGlobal("busqueda", txt);
ctx.log("Buscar:", txt);`,
  },
  {
    label: "Candado global",
    hint: "Solo 1 acción cada @SEG s en toda la app",
    group: "Combo",
    priority: 58,
    code: `const seg = @SEG ?? 5;
const ultimo = ctx.toNumber(~ultimoAccion, 0);
const ahora = ctx.now();

if (ultimo && ahora - ultimo < seg * 1000) {
  avisa("Espera " + seg + "s");
  return;
}

guardarGlobal("ultimoAccion", ahora);
// acción protegida
avisa(@MSG ?? "Hecho");`,
  },
  {
    label: "Ruleta recompensa",
    hint: "Random + condición + premio",
    group: "Combo",
    types: CLICKABLE_TYPES,
    triggers: ["click"],
    priority: 55,
    code: `const roll = aleatorio(1, @MAX ?? 100);
guardarGlobal("lastRoll", roll);

if (roll <= (@RARO ?? 5)) {
  avisa("¡Premio raro! +" + (@PTS ?? 100));
  guardarGlobal("puntos", ctx.toNumber(~puntos, 0) + (@PTS ?? 100));
} else if (roll <= (@COMUN ?? 40)) {
  avisa("Premio común");
} else {
  avisa("Sin premio — suerte: " + roll);
}`,
  },
  {
    label: "Validar todo",
    hint: "Formulario: inputs + checks + slider",
    group: "Combo",
    triggers: ["submit", "click"],
    priority: 50,
    code: `const nombre = String(leer(@NOMBRE ?? "inputNombre") ?? "").trim();
const acepta = Boolean($checkTerms);
const vol = ctx.toNumber($sliderVol, 0);

ctx.assert(nombre.length >= 2, "Nombre muy corto");
ctx.assert(acepta, "Acepta los términos");
ctx.assert(ctx.between(vol, 0, 100), "Volumen inválido");

guardarGlobal("playerName", nombre);
avisa("¡Listo para jugar, " + nombre + "!");`,
  },
];

function typeMatches(snippet: ContextualSnippet, type: HubElementType): boolean {
  if (!snippet.types?.length) return true;
  return snippet.types.includes(type);
}

function triggerMatches(snippet: ContextualSnippet, trigger: LogicTrigger): boolean {
  if (!snippet.triggers?.length) return true;
  return snippet.triggers.includes(trigger);
}

export interface SnippetContext {
  elementType: HubElementType;
  trigger: LogicTrigger;
  refId?: string;
}

/** Snippets ordenados para el elemento y disparador actuales */
export function getContextualSnippets(ctx: SnippetContext): ContextualSnippet[] {
  const { elementType, trigger, refId } = ctx;

  return CONTEXTUAL_SNIPPETS.filter(
    (s) => typeMatches(s, elementType) && triggerMatches(s, trigger)
  )
    .map((s) => personalizeSnippet(s, refId))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

function personalizeSnippet(snippet: ContextualSnippet, refId?: string): ContextualSnippet {
  if (!refId?.trim()) return snippet;
  const ref = refId.trim();
  let code = snippet.code
    .replace(/\bctx\.ref\b/g, `"${ref}"`)
    .replace(/label\(ctx\.ref,/g, `label("${ref}",`)
    .replace(/set\(ctx\.ref,/g, `set("${ref}",`);

  if (snippet.group === "Clic" && snippet.label === "Contar clics") {
    code = code.replace(`label("${ref}",`, `label("${ref}",`);
  }

  return { ...snippet, code };
}

export function getGeneralSnippets() {
  return SCRIPT_SNIPPETS;
}

export function groupSnippets<T extends { group?: string }>(
  snippets: T[]
): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const s of snippets) {
    const g = s.group ?? "Otros";
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(s);
  }
  return [...map.entries()];
}

export function elementTypeSnippetLabel(type: HubElementType): string {
  const labels: Partial<Record<HubElementType, string>> = {
    "play-button": "Botón jugar",
    button: "Botón",
    "nav-item": "Nav",
    "input-field": "Input",
    toggle: "Toggle",
    checkbox: "Checkbox",
    slider: "Slider",
    dropdown: "Select",
    counter: "Contador",
    timer: "Timer",
    "api-call": "API",
    "script-button": "Script",
  };
  return labels[type] ?? type;
}

export function triggerSnippetHint(trigger: LogicTrigger): string {
  const hints: Partial<Record<LogicTrigger, string>> = {
    click: "Se ejecuta al pulsar",
    change: "Al cambiar valor",
    load: "Al abrir la ventana",
    interval: "Cada X ms",
    submit: "Al confirmar / enviar",
    "any-click": "Cualquier clic en la pantalla",
    "phase-change": "Cambia la fase de lanzamiento",
    "launch-idle": "Sin lanzamiento activo",
    "launch-active": "Descarga / preparación",
    "launch-running": "Minecraft en ejecución",
    "launch-error": "Falló el lanzamiento",
    "launch-ended": "Juego cerrado",
    "selector-change": "Cambió un selector",
  };
  return hints[trigger] ?? trigger;
}
