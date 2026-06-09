export type CssTokenKind = "comment" | "property" | "punct" | "value" | "number" | "string" | "plain";

export interface CssToken {
  text: string;
  kind: CssTokenKind;
}

export const CSS_TOKEN_COLORS: Record<CssTokenKind, string> = {
  comment: "#5a6a5a",
  property: "#7eb8ff",
  punct: "#8b949e",
  value: "#a8c4a0",
  number: "#f0a878",
  string: "#e8c468",
  plain: "#c8d0c8",
};

function pushValueTokens(rest: string, out: CssToken[]) {
  let i = 0;
  while (i < rest.length) {
    const ch = rest[i] ?? "";
    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < rest.length && /\s/.test(rest[j] ?? "")) j++;
      out.push({ text: rest.slice(i, j), kind: "plain" });
      i = j;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < rest.length && rest[j] !== ch) j++;
      if (j < rest.length) j++;
      out.push({ text: rest.slice(i, j), kind: "string" });
      i = j;
      continue;
    }
    if (/[-\d.]/.test(ch)) {
      let j = i + 1;
      while (j < rest.length && /[-\d.a-zA-Z%]/.test(rest[j] ?? "")) j++;
      const slice = rest.slice(i, j);
      out.push({ text: slice, kind: /^-?\d/.test(slice) ? "number" : "value" });
      i = j;
      continue;
    }
    if (ch === ";") {
      out.push({ text: ";", kind: "punct" });
      i++;
      continue;
    }
    let j = i + 1;
    while (j < rest.length && !/[\s;]/.test(rest[j] ?? "")) j++;
    out.push({ text: rest.slice(i, j), kind: "value" });
    i = j;
  }
}

/** Resalta una línea del mini-editor CSS (propiedad: valor;) */
export function tokenizeCssLine(line: string): CssToken[] {
  if (!line.trim()) return [{ text: "\u00A0", kind: "plain" }];

  const leadMatch = line.match(/^(\s*)/);
  const lead = leadMatch?.[1] ?? "";
  const body = line.slice(lead.length);
  const out: CssToken[] = [];
  if (lead) out.push({ text: lead, kind: "plain" });

  const trimmed = body.trimStart();
  if (trimmed.startsWith("//") || trimmed.startsWith("#")) {
    out.push({ text: body, kind: "comment" });
    return out;
  }

  const colonIdx = body.indexOf(":");
  if (colonIdx < 0) {
    out.push({ text: body, kind: "property" });
    return out;
  }

  const propPart = body.slice(0, colonIdx);
  out.push({ text: propPart, kind: "property" });
  out.push({ text: ":", kind: "punct" });

  const afterColon = body.slice(colonIdx + 1);
  const afterLead = afterColon.match(/^(\s*)/)?.[1] ?? "";
  if (afterLead) out.push({ text: afterLead, kind: "plain" });
  pushValueTokens(afterColon.slice(afterLead.length), out);
  return out;
}

export function parseErrorLine(error: string | null): number | null {
  if (!error) return null;
  const m = error.match(/Línea\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}
