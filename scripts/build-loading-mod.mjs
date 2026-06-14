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
import { repairModProject } from "./scaffold-client-mod.mjs";
import { applyPortMod119, applyPortMod120 } from "./port-mod-120.mjs";
import { syncModernCraftMenu } from "./sync-modern-craftmenu.mjs";

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

function wrapperTemplateDir(gradleVersion) {
  const legacy = String(gradleVersion).startsWith("7");
  return path.join(
    root,
    "packages",
    legacy ? "craftlauncher-client-mod-1.16.5" : "craftlauncher-loading-mod"
  );
}

/** Copia gradlew + wrapper desde un proyecto que ya compila (evita URLs rotas de GitHub). */
function syncGradleWrapper(modDir, gradleVersion) {
  const template = wrapperTemplateDir(gradleVersion);
  const distUrl =
    gradleVersion === "8.8" || gradleVersion === "8.8.0"
      ? "https\\://services.gradle.org/distributions/gradle-8.8-bin.zip"
      : `https\\://services.gradle.org/distributions/gradle-${gradleVersion}-bin.zip`;

  for (const rel of ["gradlew", "gradlew.bat", "gradle/wrapper/gradle-wrapper.jar"]) {
    const src = path.join(template, rel);
    const dest = path.join(modDir, rel);
    if (!fs.existsSync(src)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }

  const propsPath = path.join(modDir, "gradle/wrapper/gradle-wrapper.properties");
  fs.mkdirSync(path.dirname(propsPath), { recursive: true });
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

  if (!repairModProject(mcVersion)) {
    console.error(`No se pudo reparar el proyecto ${project.dir}`);
    return 1;
  }

  if (["1.19.2", "1.20.1", "1.21.1"].includes(mcVersion)) {
    syncModernCraftMenu([mcVersion]);
    if (mcVersion === "1.19.2") applyPortMod119(mcVersion);
    if (mcVersion === "1.20.1" || mcVersion === "1.21.1") applyPortMod120(mcVersion);
  }

  syncGradleWrapper(modDir, project.gradle);

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
