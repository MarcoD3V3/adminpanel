import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { syncGameUiNow } from "./ui-bridge.mjs";
import { applyMinecraftWindowOptions } from "./minecraft-window.mjs";
import { verifyStylePack } from "./ui-pack.mjs";
import { isModJarBuiltForVersion } from "./minecraft-versions-registry.mjs";
import { validateGameUiFile, validateLoadingUi } from "./game-ui-validate.mjs";

const PACK_ID = "craftlauncher-clean";
const UI_FILE = "craftlauncher-ui.json";
const LOADING_FILE = "craftlauncher-loading-ui.json";

function step(onProgress, message, detail, level = "step") {
  onProgress?.({ stage: "install-log", level, message, detail });
}

function tryAccess(dir, mode = fs.constants.W_OK) {
  try {
    fs.accessSync(dir, mode);
    return true;
  } catch {
    return false;
  }
}

function verifyJava(javaPath) {
  const errors = [];
  if (!javaPath || !fs.existsSync(javaPath)) {
    errors.push("No se encontró el ejecutable de Java.");
    return { ok: false, errors };
  }
  try {
    execFileSync(javaPath, ["-version"], { stdio: "pipe", timeout: 15_000 });
    return { ok: true, errors: [] };
  } catch (e) {
    errors.push(`Java no responde: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, errors };
  }
}

function verifyWritableGameRoot(gameRoot) {
  const dirs = [
    gameRoot,
    path.join(gameRoot, "config"),
    path.join(gameRoot, "mods"),
    path.join(gameRoot, "resourcepacks"),
  ];
  const errors = [];
  for (const dir of dirs) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      /* ignore */
    }
    if (!tryAccess(dir)) errors.push(`Sin permiso de escritura: ${dir}`);
  }
  return { ok: errors.length === 0, errors };
}

function verifyInstalledMod(gameRoot, mcVersion) {
  const warnings = [];
  const errors = [];
  const modsDir = path.join(gameRoot, "mods");
  if (!fs.existsSync(modsDir)) {
    warnings.push("Carpeta mods/ no existe — se creará al instalar.");
    return { ok: true, warnings, errors, installed: false };
  }

  const expected = `craftlauncher-client-${mcVersion}.jar`;
  const modPath = path.join(modsDir, expected);
  if (!fs.existsSync(modPath)) {
    if (isModJarBuiltForVersion(mcVersion)) {
      warnings.push(`Mod ${expected} no está en mods/ — menú personalizado no cargará.`);
    }
    return { ok: true, warnings, errors, installed: false };
  }

  const stat = fs.statSync(modPath);
  if (stat.size < 1024) {
    errors.push(`Mod corrupto (muy pequeño): ${expected}`);
    return { ok: false, warnings, errors, installed: false };
  }

  return { ok: true, warnings, errors, installed: true, modPath };
}

function verifyResourcePack(gameRoot, mcVersion) {
  return verifyStylePack(gameRoot, mcVersion);
}

function verifyOptionsTxt(gameRoot) {
  const warnings = [];
  const optionsFile = path.join(gameRoot, "options.txt");
  if (!fs.existsSync(optionsFile)) {
    warnings.push("options.txt no existe — se creará con ventana maximizada.");
    return { ok: true, warnings };
  }

  const content = fs.readFileSync(optionsFile, "utf-8");
  if (!/fullscreen\s*:\s*false/i.test(content)) {
    warnings.push("fullscreen no está en false — se corregirá al lanzar.");
  }
  if (!/guiScale\s*:\s*0/i.test(content)) {
    warnings.push("guiScale no está en automático (0) — se corregirá al lanzar.");
  }
  if (!content.includes(PACK_ID)) {
    warnings.push("Pack de estilos no activo en options.txt — se activará al lanzar.");
  }
  return { ok: true, warnings };
}

function verifyLocalConfig(gameRoot, launchWindow) {
  const configDir = path.join(gameRoot, "config");
  const uiPath = path.join(configDir, UI_FILE);
  const warnings = [];
  const errors = [];

  let raw = "";
  try {
    raw = fs.readFileSync(uiPath, "utf-8");
  } catch {
    warnings.push("Menú del juego sin archivo local — se sincronizará desde el panel.");
    return { ok: true, warnings, errors, repaired: false };
  }

  const validated = validateGameUiFile(raw);
  if (!validated.ok) {
    errors.push(...validated.errors);
    return { ok: false, warnings: [...warnings, ...validated.warnings], errors, repaired: false };
  }

  const mergedWarnings = [...warnings, ...validated.warnings];
  const next = JSON.stringify(
    {
      ...validated.ui,
      ...(launchWindow?.width ? { targetWindowWidth: launchWindow.width } : {}),
      ...(launchWindow?.height ? { targetWindowHeight: launchWindow.height } : {}),
    },
    null,
    2
  );

  if (next !== raw) {
    fs.writeFileSync(uiPath, next, "utf-8");
    mergedWarnings.push("Menú reparado (posiciones, anclas y tamaño de diseño).");
    return { ok: true, warnings: mergedWarnings, errors: [], repaired: true };
  }

  return { ok: true, warnings: mergedWarnings, errors: [], repaired: false };
}

/**
 * Verificaciones antes de abrir Minecraft: UI, estilos, mod, Java y permisos.
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export async function runPrelaunchChecks({
  gameRoot,
  mcVersion,
  javaPath,
  launchWindow,
  onProgress,
}) {
  const errors = [];
  const warnings = [];

  step(onProgress, "Verificación pre-lanzamiento", "Comprobando entorno…", "step");

  const java = verifyJava(javaPath);
  if (!java.ok) errors.push(...java.errors);
  else step(onProgress, "Java", "Ejecutable responde correctamente", "ok");

  const writable = verifyWritableGameRoot(gameRoot);
  if (!writable.ok) errors.push(...writable.errors);
  else step(onProgress, "Carpetas del juego", "Escritura OK", "ok");

  const mod = verifyInstalledMod(gameRoot, mcVersion);
  warnings.push(...mod.warnings);
  errors.push(...mod.errors);
  if (mod.installed) step(onProgress, "Mod CraftLauncher", path.basename(mod.modPath), "ok");
  else if (mod.warnings.length) step(onProgress, "Mod CraftLauncher", mod.warnings[0], "warn");

  const pack = verifyResourcePack(gameRoot, mcVersion);
  warnings.push(...pack.warnings);
  errors.push(...(pack.errors ?? []));
  if (pack.applied) {
    step(
      onProgress,
      "Estilos (resource pack)",
      pack.repaired ? "Pack reparado para esta versión" : "Pack presente",
      pack.repaired ? "ok" : "ok"
    );
  } else {
    step(onProgress, "Estilos (resource pack)", pack.warnings[0] ?? "No encontrado", "warn");
  }

  const opts = verifyOptionsTxt(gameRoot);
  warnings.push(...opts.warnings);
  applyMinecraftWindowOptions(gameRoot);
  step(onProgress, "Ventana del juego", `${launchWindow?.width ?? "?"}×${launchWindow?.height ?? "?"} · sin F11`, "ok");

  const sync = await syncGameUiNow(gameRoot, mcVersion, { launchWindow });
  if (!sync.gameUi.ok && sync.gameUi.errors.length) {
    warnings.push(...sync.gameUi.errors);
  }
  if (sync.gameUi.warnings.length) warnings.push(...sync.gameUi.warnings);
  if (sync.gameUi.wrote) {
    step(onProgress, "Menú del juego", `Sincronizado (${sync.gameUi.source})`, "ok");
  } else if (sync.gameUi.ok) {
    step(onProgress, "Menú del juego", "Ya actualizado en disco", "info");
  } else {
    step(onProgress, "Menú del juego", "Sin datos del panel — usando archivo local", "warn");
  }

  if (sync.loadingUi.wrote) {
    step(onProgress, "Pantalla de carga", `Sincronizada (${sync.loadingUi.source})`, "ok");
  }

  const local = verifyLocalConfig(gameRoot, launchWindow);
  warnings.push(...local.warnings);
  errors.push(...local.errors);
  if (local.repaired) step(onProgress, "Menú reparado", "Coordenadas normalizadas para tu PC", "ok");

  const loadingPath = path.join(gameRoot, "config", LOADING_FILE);
  try {
    const loadingRaw = fs.readFileSync(loadingPath, "utf-8");
    const loading = validateLoadingUi(JSON.parse(loadingRaw));
    warnings.push(...loading.warnings);
  } catch {
    warnings.push("Pantalla de carga no legible — se usará valor por defecto en el juego.");
  }

  const ok = errors.length === 0;
  if (ok) {
    step(
      onProgress,
      "Verificación completa",
      warnings.length ? `${warnings.length} aviso(s) — el juego puede iniciar` : "Todo listo para cualquier resolución",
      warnings.length ? "warn" : "ok"
    );
  } else {
    step(onProgress, "Verificación fallida", errors[0], "error");
  }

  return { ok, errors, warnings };
}
