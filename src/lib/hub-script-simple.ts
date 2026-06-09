/**
 * HubScript Simple — lenguaje legible que compila a HubScript.
 *
 * Estilo familiar (como JS del navegador) pero con refs del launcher:
 *   refs.counter, constantes.META, global.visitas
 *   si / sino, avisa(), abrir(), sumar(), poner()
 */

import { compileFriendlyScript } from "@/lib/hub-script-sugar";
import type { HubScriptMode } from "@/types/hub-builder";

export type { HubScriptMode };

export const SIMPLE_SCRIPT_TEMPLATE = `// Este script corre solo con el disparador elegido (clic, cambio…)
// Refs en pantalla: usa $nombre — Constantes: @NOMBRE — Global: ~clave

si $contador >= @META {
  avisa("¡Meta alcanzada!");
  abrir("screen-play");
} sino {
  sumar($contador, 1);
}`;

export const SIMPLE_SCRIPT_GUIDE: { title: string; examples: string[] }[] = [
  {
    title: "Condiciones (como en JS)",
    examples: [
      'si $puntos >= @META { avisa("OK"); } sino { avisa("Sigue"); }',
      'si horaActual() < 12 { avisa("Buenos días"); }',
      'validar($input != "", "Escribe algo");',
    ],
  },
  {
    title: "Refs y valores",
    examples: [
      "sumar($contador, 1)     // +1 y actualiza etiqueta",
      'poner($slider, 50)      // escribe valor',
      'ponerTexto($titulo, "Hola")',
      "const n = leer($contador)",
      "refs.counter  →  $counter",
    ],
  },
  {
    title: "Acciones",
    examples: [
      'avisa("Mensaje")  // igual que alert()',
      'abrir("screen-play")',
      'mostrar("banner1") / ocultar("panel")',
      'ejecutar("otroRef")',
      'await esperar(500)',
    ],
  },
  {
    title: "Globales y constantes",
    examples: [
      'guardar("visitas", leer($contador))',
      "const v = obtener(\"visitas\")  // ~visitas",
      "constantes.META  →  @META",
    ],
  },
];

export const SIMPLE_SNIPPETS: { label: string; code: string; hint: string }[] = [
  {
    label: "Si/Sino",
    hint: "Condición clásica",
    code: `si $a >= @META {
  avisa("Correcto");
} sino {
  avisa("Aún no");
}`,
  },
  {
    label: "Sumar +1",
    hint: "Incrementa ref y muestra",
    code: "sumar($contador, 1);",
  },
  {
    label: "Hora del día",
    hint: "Como en JS: mañana vs tarde",
    code: `si horaActual() < 12 {
  avisa("Buenos días");
} sino {
  avisa("Buenas tardes");
}`,
  },
  {
    label: "Abrir ventana",
    hint: "Cambiar pantalla",
    code: 'abrir("screen-play");',
  },
  {
    label: "Validar input",
    hint: "Bloquea si está vacío",
    code: 'validar(leer($input) != "", "Campo requerido");',
  },
  {
    label: "Guardar global",
    hint: "Persiste entre elementos",
    code: 'guardar("lastScore", leer($contador));',
  },
];

function splitOutsideStrings(code: string): string[] {
  const parts: string[] = [];
  const re = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) parts.push(code.slice(last, m.index));
    parts.push(m[0]);
    last = m.index + m[0].length;
  }
  if (last < code.length) parts.push(code.slice(last));
  return parts;
}

function refName(raw: string): string {
  return raw.replace(/^\$/, "").trim();
}

function transformChunk(chunk: string): string {
  if (chunk.startsWith('"') || chunk.startsWith("'") || chunk.startsWith("`")) return chunk;

  let out = chunk;

  // Español → JS
  out = out.replace(/\bsino\b/g, "else");
  out = out.replace(/\bsi\b/g, "if");
  out = out.replace(/\bfin\b/g, "}");

  // Familiar del navegador
  out = out.replace(/\balert\s*\(/g, "avisa(");
  out = out.replace(/\bconsole\.log\s*\(/g, "log(");

  // Acceso estilo objeto → atajos Hub
  out = out.replace(/\brefs\.([A-Za-z_][A-Za-z0-9_]*)/g, "$$$1");
  out = out.replace(/\bconstantes\.([A-Za-z_][A-Za-z0-9_]*)/g, "@$1");
  out = out.replace(/\bglobal\.([A-Za-z_][A-Za-z0-9_]*)/g, "~$1");

  // alClic(() => { ... }) → solo el cuerpo (el disparador ya define el evento)
  out = out.replace(/\balClic\s*\(\s*(?:async\s+)?function\s*\([^)]*\)\s*\{/g, "{");
  out = out.replace(/\balClic\s*\(\s*(?:async\s+)?\(\)\s*=>\s*\{/g, "{");
  out = out.replace(/\balCambio\s*\(\s*(?:async\s+)?function\s*\([^)]*\)\s*\{/g, "{");
  out = out.replace(/\balCambio\s*\(\s*(?:async\s+)?\(\)\s*=>\s*\{/g, "{");

  // Helpers legibles → HubScript
  out = out.replace(/\bhoraActual\s*\(\s*\)/g, "new Date().getHours()");
  out = out.replace(/\bminutoActual\s*\(\s*\)/g, "new Date().getMinutes()");

  out = out.replace(/\bvalidar\s*\(/g, "ctx.assert(");
  out = out.replace(/\bregistrar\s*\(/g, "log(");

  out = out.replace(/\babrir\s*\(/g, "pantalla(");
  out = out.replace(/\bmostrar\s*\(/g, "mostrar(");
  out = out.replace(/\bocultar\s*\(/g, "ocultar(");
  out = out.replace(/\bejecutar\s*\(/g, "ejecutar(");
  out = out.replace(/\besperar\s*\(/g, "esperar(");

  out = out.replace(/\bobtener\s*\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\)/g, "~$1");

  out = out.replace(
    /\bguardar\s*\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*,\s*([^;)]+)\)/g,
    "guardarGlobal($1, $2)"
  );

  out = out.replace(
    /\bleer\s*\(\s*\$?([A-Za-z_][A-Za-z0-9_]*)\s*\)/g,
    (_, r) => `$${refName(r)}`
  );

  out = out.replace(
    /\bponerTexto\s*\(\s*\$?([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([^)]+)\)/g,
    (_, r, val) => `label("${refName(r)}", ${val.trim()})`
  );

  out = out.replace(
    /\bponerTexto\s*\(\s*\$?([A-Za-z_][A-Za-z0-9_]*)\s*\)/g,
    (_, r) => `label("${refName(r)}", String($${refName(r)}))`
  );

  out = out.replace(
    /\bponer\s*\(\s*\$?([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([^)]+)\)/g,
    (_, r, val) => `set("${refName(r)}", ${val.trim()})`
  );

  out = out.replace(
    /\bsumar\s*\(\s*\$?([A-Za-z_][A-Za-z0-9_]*)\s*(?:,\s*([^)]+))?\s*\)/g,
    (_, r, by) => {
      const name = refName(r);
      const step = by?.trim() ?? "1";
      return `(function(){ const __v = ctx.toNumber($${name}, 0) + (${step}); set("${name}", __v); label("${name}", String(__v)); return __v; })()`;
    }
  );

  out = out.replace(
    /\brestar\s*\(\s*\$?([A-Za-z_][A-Za-z0-9_]*)\s*(?:,\s*([^)]+))?\s*\)/g,
    (_, r, by) => {
      const name = refName(r);
      const step = by?.trim() ?? "1";
      return `(function(){ const __v = ctx.toNumber($${name}, 0) - (${step}); set("${name}", __v); label("${name}", String(__v)); return __v; })()`;
    }
  );

  out = out.replace(
    /\besVisible\s*\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\$?[A-Za-z_][A-Za-z0-9_]*)\s*\)/g,
    (_, raw) => {
      const id = raw.startsWith("$") ? refName(raw) : raw.replace(/^["']|["']$/g, "");
      return `(ctx.get("${id}")?.visible !== false)`;
    }
  );

  return out;
}

/** Convierte Simple → HubScript amigable (antes de compilar a JS) */
export function compileSimpleToHub(source: string): string {
  return splitOutsideStrings(source).map(transformChunk).join("");
}

/** Convierte Simple → JS ejecutable (pipeline completo) */
export function compileSimpleScript(source: string): string {
  return compileFriendlyScript(compileSimpleToHub(source));
}

export function isSimpleScriptMode(mode?: HubScriptMode): boolean {
  return mode === "simple";
}

export function describeSimpleScript(source: string): string {
  const s = source.trim();
  if (!s) return "Vacío — elige disparador y escribe qué debe pasar";
  if (/\bsi\b|\bif\b/i.test(s)) return "Condición si/sino";
  if (/sumar|restar/i.test(s)) return "Modificar valor";
  if (/avisa|alert/i.test(s)) return "Mostrar aviso";
  if (/abrir|pantalla/i.test(s)) return "Abrir ventana";
  if (/alClic|alCambio/i.test(s)) return "Evento (disparador también aplica)";
  return "Script simple";
}
