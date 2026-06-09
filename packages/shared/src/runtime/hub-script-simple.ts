import { compileFriendlyScript } from "./hub-script-sugar";
import type { HubScriptMode } from "../types/hub-layout";

export type { HubScriptMode };

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
  out = out.replace(/\bsino\b/g, "else");
  out = out.replace(/\bsi\b/g, "if");
  out = out.replace(/\bfin\b/g, "}");
  out = out.replace(/\balert\s*\(/g, "avisa(");
  out = out.replace(/\brefs\.([A-Za-z_][A-Za-z0-9_]*)/g, "$$$1");
  out = out.replace(/\bconstantes\.([A-Za-z_][A-Za-z0-9_]*)/g, "@$1");
  out = out.replace(/\bglobal\.([A-Za-z_][A-Za-z0-9_]*)/g, "~$1");
  out = out.replace(/\bvalidar\s*\(/g, "ctx.assert(");
  out = out.replace(/\babrir\s*\(/g, "pantalla(");
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
  return out;
}

export function compileSimpleToHub(source: string): string {
  return splitOutsideStrings(source).map(transformChunk).join("");
}

export function compileSimpleScript(source: string): string {
  return compileFriendlyScript(compileSimpleToHub(source));
}

export function isSimpleScriptMode(mode?: HubScriptMode): boolean {
  return mode === "simple";
}
