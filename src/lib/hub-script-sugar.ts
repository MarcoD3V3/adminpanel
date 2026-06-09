/**
 * Sintaxis amigable → JavaScript con ctx.*
 *
 * $contador1  → ctx.num("contador1")
 * @GOAL       → ctx.k("GOAL")
 * ~visitas    → ctx.g("visitas")
 * toast(...)  → ctx.toast(...)
 * avisa(...)  → ctx.toast(...)  (español)
 * show/hide/run → ctx.show / hide / run
 * mostrar/ocultar/ejecutar → alias en español
 * log/set/label → ctx.log / setValue / setLabel
 * alternar/esperar/aleatorio/guardarGlobal/pantalla/leer → más atajos
 */

const STRING_PATTERN = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;

function splitOutsideStrings(code: string): string[] {
  const parts: string[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(STRING_PATTERN.source, "g");
  while ((match = re.exec(code)) !== null) {
    if (match.index > last) parts.push(code.slice(last, match.index));
    parts.push(match[0]);
    last = match.index + match[0].length;
  }
  if (last < code.length) parts.push(code.slice(last));
  return parts;
}

function transformChunk(chunk: string): string {
  if (chunk.startsWith('"') || chunk.startsWith("'") || chunk.startsWith("`")) return chunk;

  let out = chunk;
  out = out.replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, 'ctx.k("$1")');
  out = out.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, 'ctx.num("$1")');
  out = out.replace(/~([A-Za-z_][A-Za-z0-9_]*)/g, 'ctx.g("$1")');
  out = out.replace(/\b(avisa|toast)\s*\(/g, "ctx.toast(");
  out = out.replace(/\b(mostrar|show)\s*\(/g, "ctx.show(");
  out = out.replace(/\b(ocultar|hide)\s*\(/g, "ctx.hide(");
  out = out.replace(/\bawait\s+(ejecutar|run)\s*\(/g, "await ctx.run(");
  out = out.replace(/\b(ejecutar|run)\s*\(/g, "await ctx.run(");
  out = out.replace(/\blog\s*\(/g, "ctx.log(");
  out = out.replace(/\bset\s*\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*,/g, "ctx.setValue($1,");
  out = out.replace(/\blabel\s*\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*,/g, "ctx.setLabel($1,");
  out = out.replace(/\balternar\s*\(/g, "ctx.toggleVisible(");
  out = out.replace(/\bawait\s+esperar\s*\(/g, "await ctx.wait(");
  out = out.replace(/\besperar\s*\(/g, "await ctx.wait(");
  out = out.replace(/\baleatorio\s*\(/g, "ctx.random(");
  out = out.replace(/\bguardarGlobal\s*\(/g, "ctx.setGlobal(");
  out = out.replace(/\b(pantalla|abrir)\s*\(/g, "ctx.setScreen(");
  out = out.replace(/\bleer\s*\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\)/g, "ctx.val($1)");
  out = out.replace(/\bexiste\s*\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\)/g, "ctx.exists($1)");
  return out;
}

/** Resumen legible del script (para vista previa humana) */
export function describeFriendlyScript(source: string): string {
  const lines = source.trim().split("\n").filter(Boolean);
  if (lines.length === 0) return "Script vacío";
  const first = lines[0];
  if (/^\s*if\s*\(/i.test(first)) return "Condición → acción";
  if (/avisa|toast/i.test(source)) return "Mostrar aviso";
  if (/mostrar|show/i.test(source)) return "Mostrar elemento";
  if (/ocultar|hide/i.test(source)) return "Ocultar elemento";
  if (/ejecutar|run/i.test(source)) return "Ejecutar otro script";
  if (/alternar/i.test(source)) return "Alternar visibilidad";
  if (/guardarGlobal|setGlobal/i.test(source)) return "Guardar global";
  if (/pantalla|setScreen/i.test(source)) return "Cambiar pantalla";
  if (/esperar|wait/i.test(source)) return "Esperar + acción";
  if (/aleatorio|random/i.test(source)) return "Número aleatorio";
  return `${lines.length} línea${lines.length === 1 ? "" : "s"} de lógica`;
}

export function compileFriendlyScript(source: string): string {
  return splitOutsideStrings(source).map(transformChunk).join("");
}

export const SCRIPT_SNIPPETS: { label: string; code: string; hint?: string; group?: string }[] = [
  { label: "Si→", code: "if ($a >= @GOAL) {\n  avisa(\"OK\");\n}", hint: "Condición + aviso", group: "Condición" },
  { label: "Si/Sino", code: "if ($a >= @MAX) {\n  avisa(\"Límite\");\n} else {\n  avisa(\"Sigue\");\n}", hint: "Con else", group: "Condición" },
  { label: "Validar", code: 'ctx.assert($input >= @MIN, "Valor inválido");', hint: "Bloquear si falla", group: "Condición" },
  { label: "+1", code: "const n = ctx.inc(\"count\");\nctx.updateElement({ label: String(n), value: n });", hint: "Contador", group: "Número" },
  { label: "Global+", code: 'guardarGlobal("visitas", ctx.toNumber(~visitas, 0) + 1);', hint: "Sumar global", group: "Número" },
  { label: "Aviso", code: 'avisa("¡Hola!");', hint: "Toast", group: "Elemento" },
  { label: "Mostrar", code: 'mostrar("banner1");', hint: "Visible", group: "Elemento" },
  { label: "Ocultar", code: 'ocultar("banner1");', hint: "Oculto", group: "Elemento" },
  { label: "Alternar", code: 'alternar("chip1");', hint: "Toggle", group: "Elemento" },
  { label: "Valor", code: 'set("contador1", 5);', hint: "Escribir número", group: "Elemento" },
  { label: "Texto", code: 'label("titulo", "Hola");', hint: "Cambiar label", group: "Elemento" },
  { label: "Ejecutar", code: 'await ejecutar("otroRef");', hint: "Otro script", group: "Elemento" },
  { label: "Esperar", code: 'await esperar(500);\navisa("Listo");', hint: "Pausa ms", group: "Tiempo" },
  { label: "Dado", code: "const n = aleatorio(1, 6);\navisa(\"Salió \" + n);", hint: "Random", group: "Extra" },
  { label: "Ventana", code: 'abrir("screen-play");', hint: "Abrir ventana", group: "Extra" },
  { label: "$ref", code: "const v = $miRef;", hint: "Leer ref", group: "Leer" },
  { label: "@CONST", code: "const m = @MAX ?? 10;", hint: "Constante", group: "Leer" },
  { label: "~glob", code: "const x = ~visitas;", hint: "Global", group: "Leer" },
];

export const GLOBAL_SUGGESTIONS = ["visitas", "premium", "lastInput", "selectedOption", "lastRoll"];

export const FRIENDLY_GUIDE: { title: string; examples: string[] }[] = [
  {
    title: "Atajos (modo simple)",
    examples: [
      "$contador1       valor numérico del ref",
      "@GOAL ?? 10      constante del panel",
      "~visitas         variable global",
      'avisa("texto")   notificación (alias toast)',
      'mostrar("ref") / ocultar("ref")',
      'await ejecutar("btn") otro script',
      'set("ref", 5) / label("ref", "txt")',
      'alternar("ref") / guardarGlobal("k", v)',
      'await esperar(500) / aleatorio(1, 6)',
      'pantalla("screen-play") / leer("ref")',
    ],
  },
  {
    title: "JavaScript normal",
    examples: [
      "if (a >= b) { ... }",
      "const / let / async / await",
      "for, while, try/catch",
    ],
  },
  {
    title: "Explícito (modo avanzado)",
    examples: [
      "ctx.num('ref') / ctx.k('MAX')",
      "ctx.setGlobal('k', v)",
      "ctx.log / ctx.assert / ctx.api",
    ],
  },
];
