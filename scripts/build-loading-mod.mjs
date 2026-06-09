#!/usr/bin/env node
/**
 * Compila el mod Forge CraftLauncher Client y lo copia a packages/launcher/assets/mods/
 * Uso: npm run build:client-mod -- 1.20.1
 *      npm run build:client-mod -- --all
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findLocalJava } from "./find-local-java.mjs";
import { ALL_MOD_MC_VERSIONS, modConfigFor } from "./mod-version-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const assetsDir = path.join(root, "packages", "launcher", "assets", "mods");

function run(cmd, args, cwd, opts = {}) {
  const shell = opts.shell ?? process.platform === "win32";
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    shell,
    ...opts,
  });
  return r.status ?? 1;
}

async function download(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

async function ensureGradleWrapper(modDir, gradleVersion) {
  const WRAPPER_BASE = `https://raw.githubusercontent.com/gradle/gradle/v${gradleVersion}`;
  const wrapperDir = path.join(modDir, "gradle", "wrapper");
  const jarPath = path.join(wrapperDir, "gradle-wrapper.jar");
  const propsPath = path.join(wrapperDir, "gradle-wrapper.properties");
  const isWin = process.platform === "win32";
  const gradlewPath = path.join(modDir, isWin ? "gradlew.bat" : "gradlew");

  const distUrl = `https\\://services.gradle.org/distributions/gradle-${gradleVersion}-bin.zip`;

  if (!fs.existsSync(propsPath)) {
    fs.mkdirSync(wrapperDir, { recursive: true });
    fs.writeFileSync(
      propsPath,
      [
        "distributionBase=GRADLE_USER_HOME",
        "distributionPath=wrapper/dists",
        `distributionUrl=${distUrl}`,
        "networkTimeout=10000",
        "validateDistributionUrl=true",
        "zipStoreBase=GRADLE_USER_HOME",
        "zipStorePath=wrapper/dists",
        "",
      ].join("\n"),
      "utf-8"
    );
  }

  if (!fs.existsSync(jarPath)) {
    console.log("Descargando gradle-wrapper.jar…");
    await download(`${WRAPPER_BASE}/gradle/wrapper/gradle-wrapper.jar`, jarPath);
  }

  if (!fs.existsSync(gradlewPath)) {
    console.log(`Descargando ${path.basename(gradlewPath)}…`);
    await download(`${WRAPPER_BASE}/${path.basename(gradlewPath)}`, gradlewPath);
    if (!isWin) fs.chmodSync(gradlewPath, 0o755);
  }
}

async function buildOne(mcVersion) {
  const project = modConfigFor(mcVersion);
  if (!project) {
    console.error(`Versión no soportada: ${mcVersion}. Disponibles: ${ALL_MOD_MC_VERSIONS.join(", ")}`);
    return 1;
  }

  const modDir = path.join(root, "packages", project.dir);
  if (!fs.existsSync(modDir)) {
    console.error(`No se encontró ${modDir} — ejecuta: node scripts/scaffold-client-mod.mjs ${mcVersion}`);
    return 1;
  }

  const java = findLocalJava(project.java);
  if (!java) {
    console.error(`
❌ No se encontró JDK ${project.java}+ usable para Minecraft ${mcVersion}.

Define JAVA_HOME o instala Java ${project.java}, luego vuelve a ejecutar:
  npm run build:client-mod -- ${mcVersion}
`);
    return 1;
  }

  console.log(`\n━━━ ${mcVersion} ━━━`);
  console.log(`Usando Java ${java.major}: ${java.path}`);
  console.log(`Proyecto mod: ${project.dir}`);

  await ensureGradleWrapper(modDir, project.gradle);

  const isWin = process.platform === "win32";
  const gradlew = path.join(modDir, isWin ? "gradlew.bat" : "gradlew");
  const gradleEnv = {
    ...process.env,
    JAVA_HOME: java.home,
    PATH: `${path.join(java.home, "bin")}${path.delimiter}${process.env.PATH ?? ""}`,
  };

  console.log(`Compilando mod Forge (${mcVersion})…`);
  const code =
    process.platform === "win32"
      ? run("cmd.exe", ["/d", "/c", gradlew, "clean", "build", "-x", "test"], modDir, { env: gradleEnv, shell: false })
      : run(gradlew, ["clean", "build", "-x", "test"], modDir, { env: gradleEnv, shell: false });
  if (code !== 0) return code;

  const libsDir = path.join(modDir, "build", "libs");
  if (!fs.existsSync(libsDir)) {
    console.error("No se generó build/libs — revisa errores de compilación arriba.");
    return 1;
  }

  const built = fs
    .readdirSync(libsDir)
    .filter((f) => f.endsWith(".jar") && !f.includes("-sources") && !f.includes("-javadoc"))
    .map((f) => path.join(libsDir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];

  if (!built) {
    console.error("No se generó ningún JAR en", libsDir);
    return 1;
  }

  fs.mkdirSync(assetsDir, { recursive: true });
  const jarName = `craftlauncher-client-${mcVersion}.jar`;
  const destJar = path.join(assetsDir, jarName);
  fs.copyFileSync(built, destJar);

  const patchDir = path.join(root, "packages", "launcher", "assets", "client-patches", mcVersion);
  fs.mkdirSync(patchDir, { recursive: true });
  fs.copyFileSync(built, path.join(patchDir, jarName));

  const meta = {
    mcVersion,
    forgeVersion: project.forge_version,
    loaderVersion: project.loaderVersion,
    jarName,
    builtAt: new Date().toISOString(),
  };
  const metaJson = JSON.stringify(meta, null, 2);
  fs.writeFileSync(`${destJar}.meta.json`, metaJson, "utf-8");
  fs.writeFileSync(path.join(patchDir, `${jarName}.meta.json`), metaJson, "utf-8");

  console.log("Copiado →", destJar);
  console.log(`✓ Mod CraftLauncher Client para Minecraft ${mcVersion} (Forge ${project.forge_version})`);
  return 0;
}

const arg = process.argv[2] ?? "1.18.2";

if (arg === "--all") {
  let failed = 0;
  for (const v of ALL_MOD_MC_VERSIONS) {
    const code = await buildOne(v);
    if (code !== 0) failed += 1;
  }
  console.log(failed === 0 ? "\n✓ Todos los mods compilados." : `\n⚠ ${failed} versión(es) fallaron.`);
  process.exit(failed === 0 ? 0 : 1);
}

process.exit(await buildOne(arg));
