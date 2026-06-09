/**
 * Sintaxis amigable → JavaScript con ctx.*
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

export function compileFriendlyScript(source: string): string {
  return splitOutsideStrings(source).map(transformChunk).join("");
}

export const GLOBAL_SUGGESTIONS = ["visitas", "premium", "lastInput", "selectedOption", "lastRoll"];
