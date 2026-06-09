import fs from "node:fs";
import path from "node:path";

/** Misma fórmula que Minecraft / game-ui-export.ts */
export function minecraftGuiScaledSize(windowW, windowH) {
  let scale = 1;
  while (scale * 320 < windowW && scale * 240 < windowH) {
    scale++;
  }
  return {
    scale,
    gw: Math.max(1, Math.floor(windowW / scale)),
    gh: Math.max(1, Math.floor(windowH / scale)),
  };
}

const DEFAULT_LAUNCH_WINDOW = { width: 1920, height: 1080 };

/** Tamaño de ventana MC (lo resuelve el proceso principal de Electron). */
export function resolveMinecraftLaunchWindow(size) {
  const w = Number(size?.width);
  const h = Number(size?.height);
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
    return {
      width: Math.max(854, Math.round(w)),
      height: Math.max(480, Math.round(h)),
    };
  }
  return { ...DEFAULT_LAUNCH_WINDOW };
}

/** Asegura ventana maximizada en modo ventana (no fullscreen exclusivo). */
export function applyMinecraftWindowOptions(gameRoot) {
  const optionsFile = path.join(gameRoot, "options.txt");
  let lines = [];
  if (fs.existsSync(optionsFile)) {
    lines = fs.readFileSync(optionsFile, "utf8").split(/\r?\n/).filter((l) => l.trim());
  }

  const upsert = (key, value) => {
    const prefix = `${key}:`;
    const row = `${key}:${value}`;
    const idx = lines.findIndex((l) => l.startsWith(prefix));
    if (idx >= 0) lines[idx] = row;
    else lines.push(row);
  };

  upsert("fullscreen", "false");
  upsert("guiScale", "0");

  fs.writeFileSync(optionsFile, `${lines.join("\n")}\n`, "utf8");
}
