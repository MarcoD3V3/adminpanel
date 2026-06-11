/** Bloque de texto copiable admin → launcher (una clave por línea). */

export type ProfileClipboardData = {
  nombre: string;
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
  push("nombre_visible", data.nombre_visible);
  push("plan", data.plan);
  push("codigo", data.codigo);
  push("id", data.id);
  push("email", data.email);
  push("referido", data.referido);
  push("notas", data.notas);
  return lines.join("\n");
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
      if (json.nombre_visible ?? json.displayName) {
        data.nombre_visible = String(json.nombre_visible ?? json.displayName);
      }
      if (json.plan ?? json.tier) data.plan = String(json.plan ?? json.tier);
      if (json.codigo ?? json.token) data.codigo = String(json.codigo ?? json.token);
      if (json.id) data.id = String(json.id);
      if (json.email) data.email = String(json.email);
      if (json.notas ?? json.notes) data.notas = String(json.notas ?? json.notes);
      if (json.referido ?? json.referral) data.referido = String(json.referido ?? json.referral);
      return data.nombre || data.contraseña || data.codigo ? data : null;
    }
  } catch {
    /* formato líneas */
  }

  const data: Partial<ProfileClipboardData> = {};
  for (const line of trimmed.split(/\r?\n/)) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;
    const field = normalizeKey(match[1] ?? "");
    if (!field) continue;
    data[field] = match[2]?.trim() ?? "";
  }

  if (!data.nombre && !data.contraseña && !data.codigo) return null;
  return data as ProfileClipboardData;
}

export function looksLikeProfileClipboard(text: string): boolean {
  return parseProfileClipboard(text) !== null;
}
