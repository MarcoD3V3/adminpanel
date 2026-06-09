import fs from "node:fs";
import path from "node:path";

/** Quita comillas envolventes del valor en .env */
function unquoteEnvValue(raw: string): string {
  const v = raw.trim();
  if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
    return v.slice(1, -1);
  }
  return v;
}

/**
 * Next.js (dotenv-expand) vacía claves con muchos `$` (p. ej. tokens CF que empiezan por $2a$10$).
 * Si process.env viene vacío, leemos la línea literal de .env.local / .env.
 */
export function resolveCurseForgeApiKey(): string | null {
  const fromProcess = process.env.CURSEFORGE_API_KEY?.trim();
  if (fromProcess) return unquoteEnvValue(fromProcess);

  for (const file of [".env.local", ".env"]) {
    try {
      const raw = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        if (!t.startsWith("CURSEFORGE_API_KEY=")) continue;
        const value = unquoteEnvValue(t.slice("CURSEFORGE_API_KEY=".length));
        if (value) return value;
      }
    } catch {
      /* archivo opcional */
    }
  }

  return null;
}
