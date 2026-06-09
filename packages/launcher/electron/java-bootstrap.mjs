import { execFileSync, execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { readJavaCache, writeJavaCache } from "./java-cache.mjs";

export function requiredJavaMajor(mcVersion) {
  const minor = parseInt(mcVersion.split(".")[1] ?? "0", 10);
  if (minor >= 18) return 17;
  if (minor === 17) return 16;
  return 8;
}

/** Java 17 cumple «>= 8» pero rompe Forge 1.12.2 — hay que acotar por era de MC. */
export function javaMeetsMcRequirement(foundMajor, minMajor) {
  if (!foundMajor || !minMajor) return false;
  if (minMajor <= 8) return foundMajor >= 8 && foundMajor <= 11;
  return foundMajor >= minMajor;
}

function parseJavaMajor(output) {
  const m = String(output).match(/version "(?:1\.)?(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function probeJava(javaPath) {
  if (!javaPath || (javaPath !== "java" && !fs.existsSync(javaPath))) return null;
  try {
    // java -version escribe en stderr (Oracle, Temurin, etc.); execFileSync sin error deja output vacío.
    const result = spawnSync(javaPath, ["-version"], {
      encoding: "utf8",
      timeout: 15_000,
      windowsHide: true,
    });
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    if (!output.trim()) return null;
    const major = parseJavaMajor(output);
    if (!major) return null;
    return { path: javaPath, major };
  } catch {
    return null;
  }
}

function collectJavaCandidates(bundledJava, userDataRoot, minMajor) {
  const seen = new Set();
  const list = [];

  function add(p) {
    if (!p) return;
    const norm = path.normalize(p);
    if (seen.has(norm)) return;
    seen.add(norm);
    list.push(norm);
  }

  add(bundledJava);

  if (userDataRoot && minMajor) {
    const bundleMajor = minMajor >= 17 ? 17 : minMajor;
    try {
      for (const entry of fs.readdirSync(userDataRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (!entry.name.startsWith(`jre-${bundleMajor}`)) continue;
        const exe = findJavaExeInTree(path.join(userDataRoot, entry.name));
        if (exe) add(exe);
      }
    } catch {
      /* ignore */
    }
  }

  const javaHome = process.env.JAVA_HOME;
  if (javaHome) {
    add(path.join(javaHome, "bin", process.platform === "win32" ? "java.exe" : "java"));
  }

  if (process.platform === "win32") {
    for (const exe of readWindowsJavaHomes()) add(exe);

    const roots = [
      process.env.ProgramFiles,
      process.env["ProgramFiles(x86)"],
      path.join(process.env.LOCALAPPDATA ?? "", "Programs"),
    ].filter(Boolean);

    for (const root of roots) {
      for (const vendor of [
        "Eclipse Adoptium",
        "Java",
        "Microsoft",
        "Zulu",
        "BellSoft",
        "Amazon Corretto",
        "Temurin",
      ]) {
        const base = path.join(root, vendor);
        if (!fs.existsSync(base)) continue;
        try {
          for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            add(path.join(base, entry.name, "bin", "java.exe"));
            const nested = path.join(base, entry.name);
            try {
              for (const sub of fs.readdirSync(nested, { withFileTypes: true })) {
                if (sub.isDirectory()) add(path.join(nested, sub.name, "bin", "java.exe"));
              }
            } catch {
              /* ignore */
            }
          }
        } catch {
          /* ignore */
        }
      }
    }

    try {
      const lines = execSync("where java", { encoding: "utf8" }).trim().split(/\r?\n/);
      for (const line of lines) add(line.trim());
    } catch {
      /* ignore */
    }
  } else {
    add("java");
  }

  return list;
}

function readWindowsJavaHomes() {
  const exes = [];
  const regRoots = [
    "HKLM\\SOFTWARE\\Eclipse Adoptium\\JDK",
    "HKLM\\SOFTWARE\\Eclipse Adoptium\\JRE",
    "HKLM\\SOFTWARE\\JavaSoft\\JDK",
    "HKLM\\SOFTWARE\\JavaSoft\\JRE",
    "HKLM\\SOFTWARE\\WOW6432Node\\JavaSoft\\JDK",
    "HKLM\\SOFTWARE\\WOW6432Node\\JavaSoft\\JRE",
    "HKLM\\SOFTWARE\\Microsoft\\JDK",
  ];

  for (const root of regRoots) {
    for (const valueName of ["JavaHome", "Path", "InstallationPath"]) {
      try {
        const out = execSync(`reg query "${root}" /s /v ${valueName} 2>nul`, {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        });
        for (const line of out.split(/\r?\n/)) {
          const m = line.match(
            new RegExp(`${valueName}\\s+REG_(?:SZ|EXPAND_SZ)\\s+(.+)`, "i")
          );
          if (!m) continue;
          const home = m[1].trim().replace(/^"|"$/g, "");
          if (/java\.exe$/i.test(home)) {
            exes.push(home);
          } else {
            exes.push(path.join(home, "bin", "java.exe"));
          }
        }
      } catch {
        /* key missing */
      }
    }
  }

  return exes;
}

function findBundledJava(userDataRoot, minMajor) {
  const bundleMajor = minMajor >= 17 ? 17 : minMajor;
  const roots = new Set();

  roots.add(bundledJavaRoot(userDataRoot, bundleMajor));
  roots.add(path.join(userDataRoot, `jre-${bundleMajor}`));

  try {
    for (const entry of fs.readdirSync(userDataRoot, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith(`jre-${bundleMajor}`)) {
        roots.add(path.join(userDataRoot, entry.name));
      }
    }
  } catch {
    /* ignore */
  }

  for (const root of roots) {
    const exe = findJavaExeInTree(root);
    if (!exe) continue;
    const info = probeJava(exe);
    if (info && javaMeetsMcRequirement(info.major, minMajor)) return info;
  }

  return null;
}

function findJavaExeInTree(dir) {
  const direct = path.join(dir, "bin", "java.exe");
  if (fs.existsSync(direct)) return direct;
  if (process.platform !== "win32") {
    const unix = path.join(dir, "bin", "java");
    if (fs.existsSync(unix)) return unix;
  }
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const found = findJavaExeInTree(path.join(dir, entry.name));
    if (found) return found;
  }
  return null;
}

function bundledJavaRoot(userDataRoot, major) {
  const pointerFile = path.join(userDataRoot, `jre-${major}.path`);
  if (fs.existsSync(pointerFile)) {
    try {
      const raw = fs.readFileSync(pointerFile, "utf8").trim();
      const root = path.isAbsolute(raw) ? raw : path.join(userDataRoot, raw);
      const javaExe = path.join(root, "bin", process.platform === "win32" ? "java.exe" : "java");
      if (fs.existsSync(javaExe)) return root;
    } catch {
      /* ignore bad pointer */
    }
  }
  return path.join(userDataRoot, `jre-${major}`);
}

function bundledJavaPath(userDataRoot, major) {
  return path.join(bundledJavaRoot(userDataRoot, major), "bin", process.platform === "win32" ? "java.exe" : "java");
}

function writeJrePointer(userDataRoot, major, root) {
  fs.mkdirSync(userDataRoot, { recursive: true });
  fs.writeFileSync(path.join(userDataRoot, `jre-${major}.path`), root, "utf8");
}

function removeDirSafe(dir) {
  if (!fs.existsSync(dir)) return true;
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 });
    return true;
  } catch {
    return false;
  }
}

function installJreTree(extractedRoot, userDataRoot, major) {
  const targetRoot = path.join(userDataRoot, `jre-${major}`);

  if (fs.existsSync(targetRoot)) {
    const existing = findJavaExeInTree(targetRoot);
    if (existing) {
      const info = probeJava(existing);
      if (info && info.major >= major) {
        writeJrePointer(userDataRoot, major, targetRoot);
        return bundledJavaPath(userDataRoot, major);
      }
    }
  }

  if (removeDirSafe(targetRoot)) {
    fs.mkdirSync(path.dirname(targetRoot), { recursive: true });
    fs.cpSync(extractedRoot, targetRoot, { recursive: true });
    writeJrePointer(userDataRoot, major, targetRoot);
    return bundledJavaPath(userDataRoot, major);
  }

  const altRoot = path.join(userDataRoot, `jre-${major}-${Date.now()}`);
  fs.cpSync(extractedRoot, altRoot, { recursive: true });
  writeJrePointer(userDataRoot, major, altRoot);
  return bundledJavaPath(userDataRoot, major);
}

async function downloadTemurinJre(major, destRoot, onProgress) {
  const apiUrl = `https://api.adoptium.net/v3/assets/latest/${major}/hotspot?architecture=x64&image_type=jre&os=windows`;
  onProgress?.({ stage: "checking", message: `Descargando Java ${major} (solo la primera vez, ~50 MB)…` });

  const metaRes = await fetch(apiUrl);
  if (!metaRes.ok) throw new Error(`No se pudo obtener Java ${major} desde Adoptium (${metaRes.status})`);

  const assets = await metaRes.json();
  const link = assets?.[0]?.binary?.package?.link;
  if (!link) throw new Error(`Enlace de descarga Java ${major} no disponible`);

  const zipPath = path.join(os.tmpdir(), `craftlauncher-jre-${major}.zip`);
  const extractDir = path.join(os.tmpdir(), `craftlauncher-jre-${major}-extract`);

  onProgress?.({ stage: "progress", message: `Descargando Java ${major}…`, percent: 5 });

  const fileRes = await fetch(link);
  if (!fileRes.ok) throw new Error(`Error al descargar Java ${major} (${fileRes.status})`);

  const buf = Buffer.from(await fileRes.arrayBuffer());
  fs.writeFileSync(zipPath, buf);

  onProgress?.({ stage: "progress", message: "Extrayendo Java…", percent: 15 });

  if (fs.existsSync(extractDir)) removeDirSafe(extractDir);
  fs.mkdirSync(extractDir, { recursive: true });

  execSync(
    `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force"`,
    { stdio: "pipe" }
  );

  const javaExe = findJavaExeInTree(extractDir);
  if (!javaExe) throw new Error("Java descargado pero no se encontró java.exe");

  const extractedRoot = path.dirname(path.dirname(javaExe));
  const finalJava = installJreTree(extractedRoot, destRoot, major);

  try {
    fs.unlinkSync(zipPath);
    removeDirSafe(extractDir);
  } catch {
    /* ignore cleanup */
  }

  if (!fs.existsSync(finalJava)) throw new Error("No se pudo instalar Java en el launcher");

  onProgress?.({
    stage: "java-ok",
    message: `Java ${major} instalado en el launcher ✓`,
    percent: 20,
  });

  return finalJava;
}

export async function ensureJavaForMinecraft(mcVersion, userDataRoot, onProgress) {
  const minMajor = requiredJavaMajor(mcVersion);
  const legacyMc = minMajor <= 8;

  const cached = readJavaCache(userDataRoot);
  if (cached) {
    const info = probeJava(cached.path);
    if (info && javaMeetsMcRequirement(info.major, minMajor)) {
      onProgress?.({
        stage: "java-ok",
        message: `Java ${info.major} en caché`,
        detail: info.path,
      });
      return info.path;
    }
    if (info && legacyMc && info.major > 11) {
      onProgress?.({
        stage: "checking",
        message: `Java ${info.major} no sirve para Minecraft ${mcVersion} — buscando Java 8…`,
      });
    }
  }

  const bundledHit = findBundledJava(userDataRoot, minMajor);
  if (bundledHit) {
    writeJavaCache(userDataRoot, { ...bundledHit, source: "launcher" });
    onProgress?.({
      stage: "java-ok",
      message: `Java ${bundledHit.major} listo (launcher)`,
      detail: bundledHit.path,
    });
    return bundledHit.path;
  }

  for (const candidate of collectJavaCandidates(null, userDataRoot, minMajor)) {
    const info = probeJava(candidate);
    if (!info || !javaMeetsMcRequirement(info.major, minMajor)) continue;
    writeJavaCache(userDataRoot, { ...info, source: "system" });
    onProgress?.({
      stage: "java-ok",
      message: `Java ${info.major} detectado en el sistema`,
      detail: info.path,
    });
    return info.path;
  }

  if (minMajor >= 17 && process.platform === "win32") {
    const javaPath = await downloadTemurinJre(17, userDataRoot, onProgress);
    const info = probeJava(javaPath);
    if (info) writeJavaCache(userDataRoot, { ...info, source: "downloaded" });
    return javaPath;
  }

  throw new Error(
    legacyMc
      ? `Minecraft ${mcVersion} (Forge) necesita Java 8. Tienes Java 17 del launcher pero no sirve para esta versión. ` +
          `Instala Temurin 8 desde https://adoptium.net/temurin/releases/?version=8 y reinicia el launcher.`
      : `Se necesita Java ${minMajor} o superior para Minecraft ${mcVersion}. ` +
          `Instala desde https://adoptium.net o reinicia el launcher tras instalar.`
  );
}
