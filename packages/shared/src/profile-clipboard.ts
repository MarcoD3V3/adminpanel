/** Bloque de texto copiable admin → launcher (una clave por línea). */

export type ProfileClipboardData = {
  nombre: string;
  /** Cifrado portal (clenc_v1:…) — solo user_web descifra en servidor */
  acceso_portal?: string;
  contraseña?: string;
  nombre_visible?: string;
  plan?: string;
  codigo?: string;
  id?: string;
  email?: string;
  notas?: string;
  referido?: string;
};

const KEY_ALIASES: Record<string, keyof ProfileClipboardData> = {
  nombre: "nombre",
  usuario: "nombre",
  user: "nombre",
  username: "nombre",
  contraseña: "contraseña",
  contrasena: "contraseña",
  password: "contraseña",
  pass: "contraseña",
  nombre_visible: "nombre_visible",
  displayname: "nombre_visible",
  plan: "plan",
  tier: "plan",
  codigo: "codigo",
  código: "codigo",
  token: "codigo",
  id: "id",
  email: "email",
  correo: "email",
  notas: "notas",
  notes: "notas",
  referido: "referido",
  referral: "referido",
  acceso_portal: "acceso_portal",
  acceso: "acceso_portal",
  portal_access: "acceso_portal",
  portal: "acceso_portal",
};

function normalizeKey(raw: string): keyof ProfileClipboardData | null {
  const key = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "_");
  return KEY_ALIASES[key] ?? null;
}

export function formatProfileClipboard(data: ProfileClipboardData): string {
  const lines: string[] = [];
  const push = (label: string, value?: string | null) => {
    const v = value?.trim();
    if (v) lines.push(`${label}:${v}`);
  };
  push("nombre", data.nombre);
  push("contraseña", data.contraseña);
  push("acceso_portal", data.acceso_portal);
  push("nombre_visible", data.nombre_visible);
  push("plan", data.plan);
  push("codigo", data.codigo);
  push("id", data.id);
  push("email", data.email);
  push("referido", data.referido);
  push("notas", data.notas);
  return lines.join("\n");
}

function parseInlinePairs(text: string): Partial<ProfileClipboardData> {
  const data: Partial<ProfileClipboardData> = {};
  const flat = text.replace(/\r?\n/g, " ").trim();
  if (!flat) return data;

  const aliasKeys = [...new Set(Object.keys(KEY_ALIASES))].sort((a, b) => b.length - a.length);
  const keyPattern = aliasKeys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`\\b(${keyPattern}):\\s*`, "gi");
  const matches = [...flat.matchAll(regex)];

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const field = normalizeKey(m[1] ?? "");
    if (!field) continue;
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? flat.length) : flat.length;
    data[field] = flat.slice(start, end).trim();
  }

  return data;
}

function countKnownKeys(text: string): number {
  let n = 0;
  for (const key of Object.keys(KEY_ALIASES)) {
    if (new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:`, "i").test(text)) n++;
  }
  return n;
}

function parseKeyValueBlock(text: string): Partial<ProfileClipboardData> {
  const trimmed = text.trim();
  if (!trimmed) return {};

  const fromLines: Partial<ProfileClipboardData> = {};
  for (const line of trimmed.split(/\r?\n/)) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;
    const field = normalizeKey(match[1] ?? "");
    if (!field) continue;
    fromLines[field] = match[2]?.trim() ?? "";
  }

  const lineKeys = Object.keys(fromLines).length;
  const inlineKeys = countKnownKeys(trimmed);
  const needsInline =
    inlineKeys > 1 &&
    (lineKeys <= 1 || Object.values(fromLines).some((v) => countKnownKeys(v ?? "") > 0));

  if (needsInline) {
    return { ...parseInlinePairs(trimmed), ...fromLines };
  }

  return fromLines;
}

/** Varios bloques separados por líneas en blanco → usa el primero con `nombre`. */
export function parseFirstProfileClipboardBlock(text: string): ProfileClipboardData | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const chunks = trimmed.split(/\n\s*\n/).map((c) => c.trim()).filter(Boolean);
  const candidates = chunks.length > 1 ? chunks : [trimmed];

  for (const chunk of candidates) {
    const parsed = parseProfileClipboard(chunk);
    if (parsed?.nombre) return parsed;
  }

  return parseProfileClipboard(trimmed);
}

export function parseProfileClipboard(text: string): ProfileClipboardData | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    if (trimmed.startsWith("{")) {
      const json = JSON.parse(trimmed) as Record<string, unknown>;
      const data: ProfileClipboardData = {
        nombre: String(json.nombre ?? json.usuario ?? json.username ?? "").trim(),
      };
      if (json.contraseña ?? json.password) data.contraseña = String(json.contraseña ?? json.password);
      if (json.acceso_portal ?? json.portalAccessSealed) {
        data.acceso_portal = String(json.acceso_portal ?? json.portalAccessSealed);
      }
      if (json.nombre_visible ?? json.displayName) {
        data.nombre_visible = String(json.nombre_visible ?? json.displayName);
      }
      if (json.plan ?? json.tier) data.plan = String(json.plan ?? json.tier);
      if (json.codigo ?? json.token) data.codigo = String(json.codigo ?? json.token);
      if (json.id) data.id = String(json.id);
      if (json.email) data.email = String(json.email);
      if (json.notas ?? json.notes) data.notas = String(json.notas ?? json.notes);
      if (json.referido ?? json.referral) data.referido = String(json.referido ?? json.referral);
      return data.nombre || data.contraseña || data.codigo || data.acceso_portal ? data : null;
    }
  } catch {
    /* formato líneas */
  }

  const data = parseKeyValueBlock(trimmed);
  if (!data.nombre && !data.contraseña && !data.codigo && !data.acceso_portal) return null;
  return data as ProfileClipboardData;
}

export function looksLikeProfileClipboard(text: string): boolean {
  return parseFirstProfileClipboardBlock(text) !== null;
}
