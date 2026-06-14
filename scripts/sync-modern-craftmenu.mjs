#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODERN_VERSIONS = ["1.19.2", "1.20.1", "1.21.1"];

function craftMenuSource() {
  const src = path.join(root, "packages/craftlauncher-loading-mod/src/main/java/io/craftlauncher/client/ui/CraftMenu.java");
  return fs
    .readFileSync(src, "utf-8")
    .replace("import net.minecraft.network.chat.TextComponent;", "import net.minecraft.network.chat.Component;")
    .replace(/new TextComponent\(/g, "Component.literal(");
}

export function syncModernCraftMenu(versions = MODERN_VERSIONS) {
  const content = craftMenuSource();
  for (const ver of versions) {
    let verContent = content;
    if (ver === "1.21.1") {
      verContent = verContent.replace(
        "import net.minecraft.client.gui.screens.OptionsScreen;",
        "import net.minecraft.client.gui.screens.options.OptionsScreen;",
      );
      verContent = verContent.replace(
        "ServerData data = new ServerData(label, server, false);",
        "ServerData data = new ServerData(label, server, ServerData.Type.OTHER);",
      );
      verContent = verContent.replace(
        "ConnectScreen.startConnecting(screen, mc, ServerAddress.parseString(server), data);",
        "ConnectScreen.startConnecting(screen, mc, ServerAddress.parseString(server), data, false, null);",
      );
    } else if (ver === "1.20.1") {
      verContent = verContent.replace(
        "ConnectScreen.startConnecting(screen, mc, ServerAddress.parseString(server), data);",
        "ConnectScreen.startConnecting(screen, mc, ServerAddress.parseString(server), data, false);",
      );
    }
    const dest = path.join(root, `packages/craftlauncher-client-mod-${ver}/src/main/java/io/craftlauncher/client/ui/CraftMenu.java`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, verContent, "utf-8");
    for (const legacy of [
      path.join(root, `packages/craftlauncher-client-mod-${ver}/src/main/java/net/minecraft/client/gui/screens/CraftMenu.java`),
      path.join(root, `packages/craftlauncher-client-mod-${ver}/src/main/java/net/minecraft/client/gui/screens/CraftLoading.java`),
    ]) {
      if (fs.existsSync(legacy)) fs.unlinkSync(legacy);
    }
  }
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  syncModernCraftMenu();
  for (const ver of MODERN_VERSIONS) console.log(`synced CraftMenu → ${ver}`);
}
