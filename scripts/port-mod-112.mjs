#!/usr/bin/env node
/** Port legacy MC 1.12.2 (GuiScreen / GuiButton, sin MatrixStack). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = path.join(root, "packages/craftlauncher-client-mod-1.12.2/src/main/java");

function write(rel, content) {
  const full = path.join(base, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf-8");
  console.log("wrote", rel);
}

write("io/craftlauncher/loading/mixin/ScreenAccessor.java", `package io.craftlauncher.loading.mixin;

import java.util.List;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiButton;
import net.minecraft.client.gui.GuiScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;

@Mixin(GuiScreen.class)
public interface ScreenAccessor {
    @Accessor("mc")
    Minecraft craftlauncher$getMinecraft();

    @Accessor("buttonList")
    List<GuiButton> craftlauncher$getButtons();
}
`);

write("io/craftlauncher/client/ui/CraftButton.java", `package io.craftlauncher.client.ui;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.FontRenderer;
import net.minecraft.client.gui.Gui;
import net.minecraft.client.gui.GuiButton;
import net.minecraft.client.renderer.GlStateManager;

public class CraftButton extends GuiButton {
    private final int bgColor;
    private final int hoverColor;
    private final int borderColor;
    private final int textColor;
    private final boolean drawBg;
    private final float textScale;
    private final boolean leftAlign;

    public interface PressAction {
        void onPress(CraftButton button);
    }

    public CraftButton(int x, int y, int w, int h, String msg, PressAction onPress,
                       int bgColor, int hoverColor, int borderColor, int textColor, boolean drawBg) {
        this(x, y, w, h, msg, onPress, bgColor, hoverColor, borderColor, textColor, drawBg, 1f, false);
    }

    public CraftButton(int x, int y, int w, int h, String msg, PressAction onPress,
                       int bgColor, int hoverColor, int borderColor, int textColor, boolean drawBg,
                       float textScale, boolean leftAlign) {
        super(0, x, y, w, h, msg);
        this.bgColor = bgColor;
        this.hoverColor = hoverColor;
        this.borderColor = borderColor;
        this.textColor = textColor;
        this.drawBg = drawBg;
        this.textScale = textScale;
        this.leftAlign = leftAlign;
        this.onPress = onPress;
    }

    private final PressAction onPress;

    @Override
    public void drawButton(Minecraft mc, int mouseX, int mouseY, float partialTicks) {
        if (!this.visible) return;
        if (drawBg) {
            int bg = this.hovered ? hoverColor : bgColor;
            Gui.drawRect(this.x, this.y, this.x + this.width, this.y + this.height, bg);
            Gui.drawRect(this.x, this.y, this.x + this.width, this.y + 1, borderColor);
            Gui.drawRect(this.x, this.y + this.height - 1, this.x + this.width, this.y + this.height, borderColor);
            Gui.drawRect(this.x, this.y, this.x + 1, this.y + this.height, borderColor);
            Gui.drawRect(this.x + this.width - 1, this.y, this.x + this.width, this.y + this.height, borderColor);
        }
        FontRenderer font = mc.fontRenderer;
        String text = this.displayString;
        if (textScale != 1f) {
            GlStateManager.pushMatrix();
            float cx = this.x + this.width / 2f;
            float cy = this.y + this.height / 2f;
            GlStateManager.translate(cx, cy, 0);
            GlStateManager.scale(textScale, textScale, 1f);
            drawCenteredString(font, text, 0, -4, textColor);
            GlStateManager.popMatrix();
        } else if (leftAlign) {
            font.drawString(text, this.x + 2, this.y + (this.height - 8) / 2, textColor);
        } else {
            drawCenteredString(font, text, this.x + this.width / 2, this.y + (this.height - 8) / 2, textColor);
        }
    }

    @Override
    public boolean mousePressed(Minecraft mc, int mouseX, int mouseY) {
        if (super.mousePressed(mc, mouseX, mouseY) && onPress != null) {
            onPress.onPress(this);
            return true;
        }
        return false;
    }
}
`);

write("io/craftlauncher/client/ui/CraftMenu.java", `package io.craftlauncher.client.ui;

import java.io.File;
import java.io.FileReader;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import io.craftlauncher.loading.mixin.ScreenAccessor;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiMainMenu;
import net.minecraft.client.gui.GuiMultiplayer;
import net.minecraft.client.gui.GuiOptions;
import net.minecraft.client.gui.GuiWorldSelection;
import net.minecraft.client.gui.GuiButton;
import net.minecraftforge.fml.client.GuiModList;

public final class CraftMenu {
    private CraftMenu() {}

    private static long lastModified = Long.MIN_VALUE;
    private static boolean hideVanillaDecor = true;

    public static boolean hideVanillaDecor() {
        return hideVanillaDecor;
    }

    private static File configFile() {
        return new File(net.minecraftforge.fml.common.Loader.instance().getConfigDir(), "craftlauncher-ui.json");
    }

    public static void build(GuiMainMenu screen) {
        ScreenAccessor access = (ScreenAccessor) screen;
        Minecraft mc = access.craftlauncher$getMinecraft();
        access.craftlauncher$getButtons().clear();

        File cfg = configFile();
        lastModified = cfg.exists() ? cfg.lastModified() : -1L;

        int gw = screen.width;
        int gh = screen.height;
        JsonObject root = readJson(cfg);
        hideVanillaDecor = root == null || !root.has("hideVanillaDecor") || root.get("hideVanillaDecor").getAsBoolean();

        if (root != null && root.has("elements")) {
            JsonArray els = root.getAsJsonArray("elements");
            for (JsonElement e : els) {
                if (!e.isJsonObject()) continue;
                JsonObject o = e.getAsJsonObject();
                String type = getString(o, "type", "button");

                int w = getInt(o, "w", 160);
                int h = getInt(o, "h", 20);
                int x = resolveAnchorX(o, gw, w);
                int y = resolveAnchorY(o, gh, h);

                int bg = parseColor(getString(o, "bg", "#cc2b2e33"), 0xCC2B2E33);
                int bgHover = parseColor(getString(o, "bgHover", "#ff3a3e45"), 0xFF3A3E45);
                int border = parseColor(getString(o, "border", "#ff5b5f66"), 0xFF5B5F66);
                int textColor = parseColor(getString(o, "textColor", "#ffe8eaed"), 0xFFE8EAED);

                String binding = getString(o, "binding", null);
                String labelText = resolveElementText(o, binding);
                if ("label".equals(type)) {
                    if (labelText == null || labelText.isEmpty()) continue;
                    CraftButton lbl = new CraftButton(x, y, w, h, labelText, b -> {},
                            0, 0, 0, textColor, false,
                            CraftMenuBindings.textScaleFor(binding),
                            CraftMenuBindings.leftAlignFor(binding));
                    lbl.enabled = false;
                    access.craftlauncher$getButtons().add(lbl);
                    continue;
                }

                CraftButton b = new CraftButton(x, y, w, h,
                        labelText != null ? labelText : getString(o, "text", ""),
                        makeAction(o, screen, mc),
                        bg, bgHover, border, textColor, true,
                        CraftMenuBindings.textScaleFor(binding),
                        CraftMenuBindings.leftAlignFor(binding));
                access.craftlauncher$getButtons().add(b);
            }
        }
    }

    private static String resolveElementText(JsonObject o, String binding) {
        if (binding != null && !binding.isEmpty()) {
            String resolved = CraftMenuBindings.resolve(binding);
            if (resolved != null) return resolved;
        }
        return getString(o, "text", "");
    }

    public static void tick(GuiMainMenu screen) {
        ScreenAccessor access = (ScreenAccessor) screen;
        Minecraft mc = access.craftlauncher$getMinecraft();
        File cfg = configFile();
        long m = cfg.exists() ? cfg.lastModified() : -1L;
        if (m != lastModified) {
            lastModified = m;
            mc.displayGuiScreen(new GuiMainMenu());
        }
    }

    private static int resolveAnchorX(JsonObject o, int gw, int w) {
        String ax = getString(o, "anchorX", null);
        int off = getInt(o, "offsetX", Integer.MIN_VALUE);
        if (ax == null) {
            JsonElement xe = o.get("x");
            if (xe != null && xe.isJsonPrimitive()) {
                if (xe.getAsJsonPrimitive().isNumber()) return xe.getAsInt();
                String v = xe.getAsString();
                if ("left".equals(v)) return 8;
                if ("right".equals(v)) return gw - w - 8;
                return gw / 2 - w / 2;
            }
            return gw / 2 - w / 2;
        }
        if (off == Integer.MIN_VALUE) off = 0;
        switch (ax) {
            case "left": return off;
            case "right": return gw - w - off;
            default: return gw / 2 - w / 2 + off;
        }
    }

    private static int resolveAnchorY(JsonObject o, int gh, int h) {
        String ay = getString(o, "anchorY", null);
        int off = getInt(o, "offsetY", Integer.MIN_VALUE);
        if (ay == null) {
            JsonElement ye = o.get("y");
            if (ye != null && ye.isJsonPrimitive()) {
                if (ye.getAsJsonPrimitive().isNumber()) return ye.getAsInt();
                if ("center".equals(ye.getAsString())) return gh / 2 - h / 2;
            }
            return 40;
        }
        if (off == Integer.MIN_VALUE) off = 0;
        switch (ay) {
            case "top": return off;
            case "bottom": return gh - h - off;
            default: return gh / 2 - h / 2 + off;
        }
    }

    private static CraftButton.PressAction makeAction(JsonObject o, GuiMainMenu screen, Minecraft mc) {
        String action = getString(o, "action", "");
        String url = getString(o, "url", "");
        switch (action) {
            case "singleplayer": return b -> mc.displayGuiScreen(new GuiWorldSelection(screen));
            case "multiplayer": return b -> mc.displayGuiScreen(new GuiMultiplayer(screen));
            case "options": return b -> mc.displayGuiScreen(new GuiOptions(screen, mc.gameSettings));
            case "mods": return b -> mc.displayGuiScreen(new GuiModList(screen));
            case "quit": return b -> mc.shutdown();
            case "url": return b -> {
                try {
                    java.awt.Desktop.getDesktop().browse(new java.net.URI(url));
                } catch (Exception ignored) {
                }
            };
            default: return b -> {};
        }
    }

    private static int parseColor(String hex, int fallback) {
        if (hex == null) return fallback;
        String s = hex.trim();
        if (s.startsWith("#")) s = s.substring(1);
        try {
            if (s.length() == 6) return 0xFF000000 | (int) Long.parseLong(s, 16);
            if (s.length() == 8) return (int) Long.parseLong(s, 16);
        } catch (NumberFormatException ignored) {
        }
        return fallback;
    }

    private static JsonObject readJson(File f) {
        if (f == null || !f.exists()) return null;
        try (FileReader r = new FileReader(f)) {
            JsonElement el = new JsonParser().parse(r);
            return el.isJsonObject() ? el.getAsJsonObject() : null;
        } catch (Throwable t) {
            return null;
        }
    }

    private static String getString(JsonObject o, String k, String d) {
        try {
            return o.has(k) && !o.get(k).isJsonNull() ? o.get(k).getAsString() : d;
        } catch (Throwable t) {
            return d;
        }
    }

    private static int getInt(JsonObject o, String k, int d) {
        try {
            return o.has(k) && !o.get(k).isJsonNull() ? o.get(k).getAsInt() : d;
        } catch (Throwable t) {
            return d;
        }
    }
}
`);

write("io/craftlauncher/loading/mixin/TitleScreenMixin.java", `package io.craftlauncher.loading.mixin;

import io.craftlauncher.client.ui.CraftMenu;
import net.minecraft.client.gui.GuiMainMenu;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(GuiMainMenu.class)
public abstract class TitleScreenMixin {
    @Inject(method = "initGui", at = @At("RETURN"))
    private void craftlauncher$initAfter(CallbackInfo ci) {
        CraftMenu.build((GuiMainMenu) (Object) this);
    }

    @Inject(method = "updateScreen", at = @At("HEAD"))
    private void craftlauncher$tick(CallbackInfo ci) {
        CraftMenu.tick((GuiMainMenu) (Object) this);
    }
}
`);

write("io/craftlauncher/client/ui/CraftMenuBindings.java", `package io.craftlauncher.client.ui;

import net.minecraftforge.common.ForgeVersion;
import net.minecraftforge.fml.common.Loader;

public final class CraftMenuBindings {
    private CraftMenuBindings() {}

    public static String resolve(String binding) {
        if (binding == null || binding.isEmpty()) return null;
        switch (binding) {
            case "minecraft_logo":
                return "MINECRAFT";
            case "java_edition":
                return "Java Edition";
            case "forge_version":
                return "Forge " + forgeVersion();
            case "minecraft_version":
                return "Minecraft " + minecraftVersion();
            case "mcp_version":
                return "MCP " + mcpVersion(minecraftVersion());
            case "mods_loaded":
                return modsLoadedLine();
            case "forge_update":
                return forgeUpdateLine(minecraftVersion());
            default:
                return null;
        }
    }

    public static boolean isLogoBinding(String binding) {
        return "minecraft_logo".equals(binding);
    }

    private static String forgeVersion() {
        try {
            return ForgeVersion.getVersion();
        } catch (Throwable ignored) {
            return "?.?.?";
        }
    }

    private static String minecraftVersion() {
        try {
            return ForgeVersion.mcVersion;
        } catch (Throwable ignored) {
            return "?";
        }
    }

    private static String mcpVersion(String mc) {
        if ("1.12.2".equals(mc)) return "20171003-1.12";
        return "—";
    }

    private static String modsLoadedLine() {
        try {
            long count = Loader.instance().getModList().stream()
                    .filter(m -> {
                        String id = m.getModId();
                        return id != null && !"minecraft".equals(id) && !"forge".equals(id) && !"FML".equals(id);
                    })
                    .count();
            return count + (count == 1 ? " mod loaded" : " mods loaded");
        } catch (Throwable ignored) {
            return "0 mods loaded";
        }
    }

    private static String forgeUpdateLine(String mc) {
        String next = forgeUpdateHint(mc);
        return next.isEmpty() ? "" : "New Forge version available: " + next;
    }

    private static String forgeUpdateHint(String mc) {
        if ("1.12.2".equals(mc)) return "14.23.5.2860";
        return "";
    }

    public static float textScaleFor(String binding) {
        return isLogoBinding(binding) ? 2.4f : 1f;
    }

    public static boolean leftAlignFor(String binding) {
        if (binding == null) return false;
        switch (binding) {
            case "forge_version":
            case "minecraft_version":
            case "mcp_version":
            case "mods_loaded":
            case "forge_update":
                return true;
            default:
                return false;
        }
    }
}
`);

write("io/craftlauncher/loading/CraftLauncherLoadingMod.java", `package io.craftlauncher.loading;

import net.minecraftforge.fml.common.Mod;

@Mod(
        modid = CraftLauncherLoadingMod.MOD_ID,
        name = "CraftLauncher Client",
        version = "1.0.0",
        clientSideOnly = true,
        acceptableRemoteVersions = "*"
)
public class CraftLauncherLoadingMod {
    public static final String MOD_ID = "craftlauncher_loading";
}
`);

const mixinsJson = path.join(root, "packages/craftlauncher-client-mod-1.12.2/src/main/resources/craftlauncher_loading.mixins.json");
fs.writeFileSync(mixinsJson, JSON.stringify({
  required: true,
  minVersion: "0.8",
  package: "io.craftlauncher.loading.mixin",
  compatibilityLevel: "JAVA_8",
  refmap: "craftlauncher_loading.refmap.json",
  client: ["ScreenAccessor", "TitleScreenMixin"],
}, null, 2));

const mcmodInfo = path.join(root, "packages/craftlauncher-client-mod-1.12.2/src/main/resources/mcmod.info");
fs.writeFileSync(mcmodInfo, `[
{
  "modid": "craftlauncher_loading",
  "name": "CraftLauncher Client",
  "description": "Menú principal personalizable desde CraftLauncher Hub Builder (config/craftlauncher-ui.json).",
  "version": "\${mod_version}",
  "mcversion": "\${minecraft_version}",
  "url": "https://github.com/craftlauncher/craftlauncher",
  "updateUrl": "",
  "authorList": ["CraftLauncher"],
  "credits": "",
  "logoFile": "",
  "screenshots": [],
  "dependencies": []
}
]
`, "utf-8");

console.log("✓ Port 1.12.2 aplicado");
