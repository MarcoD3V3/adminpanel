#!/usr/bin/env node
/**
 * Genera un proyecto Gradle del mod para una versión MC (copia plantilla + parches).
 * Uso: node scripts/scaffold-client-mod.mjs 1.20.1
 *      node scripts/scaffold-client-mod.mjs --all
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MOD_VERSION_CONFIG, ALL_MOD_MC_VERSIONS } from "./mod-version-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const packagesDir = path.join(root, "packages");

const SKIP_DIRS = new Set(["build", ".gradle", "run", ".idea", "out"]);

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (SKIP_DIRS.has(name)) continue;
    const from = path.join(src, name);
    const to = path.join(dest, name);
    const stat = fs.statSync(from);
    if (stat.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function patchFile(filePath, replacers) {
  if (!fs.existsSync(filePath)) return;
  let text = fs.readFileSync(filePath, "utf-8");
  for (const [from, to] of replacers) {
    text = typeof from === "string" ? text.split(from).join(to) : text.replace(from, to);
  }
  fs.writeFileSync(filePath, text, "utf-8");
}

function patchJavaSources(modDir, mcVersion) {
  const major = Number.parseInt(mcVersion.split(".")[1] ?? "0", 10);
  if (major < 19) return;

  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".java")) {
        patchFile(full, [
          ["import net.minecraft.network.chat.TextComponent;", "import net.minecraft.network.chat.Component;"],
          [/new TextComponent\(/g, "Component.literal("],
        ]);
      }
    }
  };
  walk(path.join(modDir, "src"));
}

function patchModsToml(modDir, cfg) {
  const toml = path.join(modDir, "src", "main", "resources", "META-INF", "mods.toml");
  if (!fs.existsSync(toml)) return;
  patchFile(toml, [
    [/loaderVersion="\[40,\)"/, `loaderVersion="${cfg.loaderRange}"`],
    [/versionRange="\[1\.18\.2,1\.19\)"/, `versionRange="${cfg.mcRange}"`],
    [/versionRange="\[1\.16\.5,1\.17\)"/, `versionRange="${cfg.mcRange}"`],
    [/versionRange="\[36,\)"/, `versionRange="${cfg.loaderRange}"`],
  ]);
  let text = fs.readFileSync(toml, "utf-8");
  if (!text.includes(cfg.loaderRange)) {
    text = text.replace(/loaderVersion="[^"]+"/, `loaderVersion="${cfg.loaderRange}"`);
  }
  if (!text.includes(cfg.mcRange)) {
    text = text.replace(
      /(\[\[dependencies\.craftlauncher_loading\]\][\s\S]*?modId="minecraft"[\s\S]*?versionRange=")[^"]+(")/m,
      `$1${cfg.mcRange}$2`
    );
  }
  fs.writeFileSync(toml, text, "utf-8");
}

function templateDirFor(cfg) {
  return cfg.template === "legacy"
    ? path.join(packagesDir, "craftlauncher-client-mod-1.16.5")
    : path.join(packagesDir, "craftlauncher-loading-mod");
}

function writeGradleProperties(destDir, cfg) {
  const propsText = [
    "org.gradle.jvmargs=-Xmx3G",
    "org.gradle.daemon=false",
    "",
    `minecraft_version=${cfg.minecraft_version}`,
    `forge_version=${cfg.forge_version}`,
    `mapping_channel=${cfg.mapping_channel}`,
    `mapping_version=${cfg.mapping_version}`,
    "",
    "mod_id=craftlauncher_loading",
    "mod_name=CraftLauncher Client",
    "mod_version=1.0.0",
    "mod_group=io.craftlauncher.loading",
    "",
    `java_version=${cfg.java}`,
    "",
  ].join("\n");
  fs.writeFileSync(path.join(destDir, "gradle.properties"), propsText, "utf-8");
}

function applyProjectPatches(destDir, cfg, mcVersion) {
  if (cfg.template === "legacy") {
    patchFile(path.join(destDir, "build.gradle"), [
      ["craftlauncher-client-1.16.5", cfg.archivesName],
      ["JavaLanguageVersion.of(8)", `JavaLanguageVersion.of(${cfg.java})`],
    ]);
  } else {
    patchFile(path.join(destDir, "build.gradle"), [
      ["archivesName = 'craftlauncher-loading'", `archivesName = '${cfg.archivesName}'`],
      [
        /java\.toolchain\.languageVersion = JavaLanguageVersion\.of\(Integer\.parseInt\(java_version\)\)/,
        `java.toolchain.languageVersion = JavaLanguageVersion.of(${cfg.java})`,
      ],
    ]);
  }

  patchModsToml(destDir, cfg);

  if (cfg.template === "modern") {
    patchJavaSources(destDir, mcVersion);
  }

  if (!fs.existsSync(path.join(destDir, "src", "main", "resources", "pack.mcmeta"))) {
    fs.writeFileSync(
      path.join(destDir, "src", "main", "resources", "pack.mcmeta"),
      JSON.stringify({ pack: { description: "CraftLauncher", pack_format: cfg.template === "legacy" ? 6 : 9 } }, null, 2),
      "utf-8"
    );
  }
}

function scaffoldOne(mcVersion) {
  const cfg = MOD_VERSION_CONFIG[mcVersion];
  if (!cfg) {
    console.error(`Versión desconocida: ${mcVersion}`);
    return false;
  }

  const templateDir = templateDirFor(cfg);
  const destDir = path.join(packagesDir, cfg.dir);

  if (!fs.existsSync(templateDir)) {
    console.error(`Plantilla no encontrada: ${templateDir}`);
    return false;
  }

  if (fs.existsSync(destDir)) {
    console.log(`Ya existe ${cfg.dir} — omitiendo scaffold`);
    return true;
  }

  console.log(`Scaffolding ${cfg.dir} desde ${path.basename(templateDir)}…`);
  copyDir(templateDir, destDir);
  writeGradleProperties(destDir, cfg);
  applyProjectPatches(destDir, cfg, mcVersion);
  console.log(`✓ ${cfg.dir}`);
  return true;
}

/** Repara proyectos a medias (sin build.gradle) copiando la plantilla completa. */
export function repairModProject(mcVersion) {
  const cfg = MOD_VERSION_CONFIG[mcVersion];
  if (!cfg) return false;

  const templateDir = templateDirFor(cfg);
  const destDir = path.join(packagesDir, cfg.dir);

  if (!fs.existsSync(templateDir)) {
    console.error(`Plantilla no encontrada: ${templateDir}`);
    return false;
  }

  if (!fs.existsSync(destDir)) {
    return scaffoldOne(mcVersion);
  }

  const requiredFiles =
    cfg.template === "legacy"
      ? ["build.gradle", "src/main/java/io/craftlauncher/client/ui/CraftButton.java"]
      : ["build.gradle", "src/main/resources/META-INF/mods.toml"];
  const incomplete = requiredFiles.some((rel) => !fs.existsSync(path.join(destDir, rel)));
  if (incomplete) {
    console.log(`Reparando proyecto incompleto: ${cfg.dir}…`);
    copyDir(templateDir, destDir);
  }

  writeGradleProperties(destDir, cfg);
  applyProjectPatches(destDir, cfg, mcVersion);
  return true;
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const arg = process.argv[2] ?? "--all";
  if (arg === "--all") {
    let ok = true;
    for (const v of ALL_MOD_MC_VERSIONS) {
      if (v === "1.18.2" || v === "1.16.5") continue;
      if (!scaffoldOne(v)) ok = false;
    }
    process.exit(ok ? 0 : 1);
  } else {
    process.exit(scaffoldOne(arg) ? 0 : 1);
  }
}
