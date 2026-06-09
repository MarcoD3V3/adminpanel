#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "packages/craftlauncher-loading-mod/src/main/java/io/craftlauncher/client/ui/CraftMenu.java");

let content = fs.readFileSync(src, "utf-8");
content = content
  .replace("import net.minecraft.network.chat.TextComponent;", "import net.minecraft.network.chat.Component;")
  .replace(/new TextComponent\(/g, "Component.literal(");

for (const ver of ["1.19.2", "1.20.1", "1.21.1"]) {
  let verContent = content;
  if (ver === "1.21.1") {
    verContent = verContent.replace(
      "import net.minecraft.client.gui.screens.OptionsScreen;",
      "import net.minecraft.client.gui.screens.options.OptionsScreen;",
    );
  }
  const dest = path.join(root, `packages/craftlauncher-client-mod-${ver}/src/main/java/io/craftlauncher/client/ui/CraftMenu.java`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, verContent, "utf-8");
  const legacy = path.join(root, `packages/craftlauncher-client-mod-${ver}/src/main/java/net/minecraft/client/gui/screens/CraftMenu.java`);
  if (fs.existsSync(legacy)) fs.unlinkSync(legacy);
  const loading = path.join(root, `packages/craftlauncher-client-mod-${ver}/src/main/java/net/minecraft/client/gui/screens/CraftLoading.java`);
  if (fs.existsSync(loading)) fs.unlinkSync(loading);
  console.log(`synced CraftMenu → ${ver}`);
}
