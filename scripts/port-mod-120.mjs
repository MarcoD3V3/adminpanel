#!/usr/bin/env node
/** Aplica port GuiGraphics (MC 1.20+) a proyectos modernos 1.20.1 y 1.21.1 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function write(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf-8");
}

export function applyPortMod119(mcVersion) {
  if (mcVersion !== "1.19.2") return;

  const base = `packages/craftlauncher-client-mod-${mcVersion}/src/main/java`;
  write(`${base}/io/craftlauncher/loading/mixin/TitleScreenDecorMixin.java`, titleScreenDecorMixin119);
}

export function applyPortMod120(mcVersion) {
  if (mcVersion !== "1.20.1" && mcVersion !== "1.21.1") return;

  const base = `packages/craftlauncher-client-mod-${mcVersion}/src/main/java`;
  write(`${base}/io/craftlauncher/client/ui/CraftButton.java`, craftButton);
  const legacyBtn = path.join(root, `packages/craftlauncher-client-mod-${mcVersion}/src/main/java/net/minecraft/client/gui/screens/CraftButton.java`);
  if (fs.existsSync(legacyBtn)) fs.unlinkSync(legacyBtn);
  write(`${base}/io/craftlauncher/loading/LoadingRenderer.java`, loadingRenderer);
  write(`${base}/io/craftlauncher/loading/mixin/LoadingOverlayMixin.java`, loadingOverlayMixin);
  write(`${base}/io/craftlauncher/loading/mixin/ScreenAccessor.java`, screenAccessor120);
  write(
    `${base}/io/craftlauncher/loading/mixin/TitleScreenDecorMixin.java`,
    mcVersion === "1.21.1" ? titleScreenDecorMixin121 : titleScreenDecorMixin,
  );
}

const craftButton = `package io.craftlauncher.client.ui;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.network.chat.Component;

public class CraftButton extends Button {
    private final int bgColor;
    private final int hoverColor;
    private final int borderColor;
    private final int textColor;
    private final boolean drawBg;
    private final float textScale;
    private final boolean leftAlign;

    public CraftButton(int x, int y, int w, int h, Component msg, OnPress onPress,
                       int bgColor, int hoverColor, int borderColor, int textColor, boolean drawBg) {
        this(x, y, w, h, msg, onPress, bgColor, hoverColor, borderColor, textColor, drawBg, 1f, false);
    }

    public CraftButton(int x, int y, int w, int h, Component msg, OnPress onPress,
                       int bgColor, int hoverColor, int borderColor, int textColor, boolean drawBg,
                       float textScale, boolean leftAlign) {
        super(x, y, w, h, msg, onPress, DEFAULT_NARRATION);
        this.bgColor = bgColor;
        this.hoverColor = hoverColor;
        this.borderColor = borderColor;
        this.textColor = textColor;
        this.drawBg = drawBg;
        this.textScale = textScale;
        this.leftAlign = leftAlign;
    }

    @Override
    public void renderWidget(GuiGraphics gui, int mouseX, int mouseY, float partial) {
        int left = getX();
        int top = getY();
        int right = left + getWidth();
        int bottom = top + getHeight();
        if (drawBg) {
            int bg = isHoveredOrFocused() ? hoverColor : bgColor;
            gui.fill(left, top, right, bottom, bg);
            gui.fill(left, top, right, top + 1, borderColor);
            gui.fill(left, bottom - 1, right, bottom, borderColor);
            gui.fill(left, top, left + 1, bottom, borderColor);
            gui.fill(right - 1, top, right, bottom, borderColor);
        }
        var font = Minecraft.getInstance().font;
        String text = getMessage().getString();
        if (textScale != 1f) {
            gui.pose().pushPose();
            float cx = left + getWidth() / 2f;
            float cy = top + getHeight() / 2f;
            gui.pose().translate(cx, cy, 0);
            gui.pose().scale(textScale, textScale, 1f);
            gui.drawCenteredString(font, text, 0, -4, textColor);
            gui.pose().popPose();
        } else if (leftAlign) {
            gui.drawString(font, text, left + 2, top + (getHeight() - 8) / 2, textColor);
        } else {
            gui.drawCenteredString(font, text, left + getWidth() / 2, top + (getHeight() - 8) / 2, textColor);
        }
    }
}
`;

const loadingRenderer = `package io.craftlauncher.loading;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.util.Mth;

public final class LoadingRenderer {
    private LoadingRenderer() {}

    public static void render(Minecraft mc, GuiGraphics gui, float partialTick, float progress) {
        LoadingConfig cfg = LoadingConfig.get();
        int width = mc.getWindow().getGuiScaledWidth();
        int height = mc.getWindow().getGuiScaledHeight();

        int bg = parseColor(cfg.backgroundColor, 0xFF0a0b0d);
        gui.fill(0, 0, width, height, bg);

        var font = mc.font;
        if (cfg.brandText != null && !cfg.brandText.isBlank()) {
            String text = cfg.brandText.trim();
            int color = parseColor(cfg.brandColor, 0xFF8b8d92);
            gui.drawCenteredString(font, text, width / 2, (int) (height * 0.46f), color);
        }

        float clamped = Mth.clamp(progress, 0f, 1f);
        double ratio = cfg.progressWidthRatio <= 0 ? 0.42 : Math.min(1, cfg.progressWidthRatio);
        int barW = (int) (width * ratio);
        int barH = Math.max(2, cfg.progressHeight);
        int barX = (width - barW) / 2;
        int barY = (int) (height * 0.54f);

        int track = parseColor(cfg.progressTrackColor, 0xFF1a1d22);
        gui.fill(barX, barY, barX + barW, barY + barH, track);

        int fill = parseColor(cfg.progressColor, 0xFF6b9e78);
        int fillW = Math.max(0, (int) (barW * clamped));
        if (fillW > 0) {
            gui.fill(barX, barY, barX + fillW, barY + barH, fill);
        }
    }

    static int parseColor(String hex, int fallback) {
        if (hex == null || hex.isBlank()) return fallback | 0xFF000000;
        String s = hex.trim();
        if (s.startsWith("#")) s = s.substring(1);
        if (s.length() == 6) {
            try {
                return 0xFF000000 | Integer.parseInt(s, 16);
            } catch (NumberFormatException ignored) {
                return fallback | 0xFF000000;
            }
        }
        return fallback | 0xFF000000;
    }
}
`;

const loadingOverlayMixin = `package io.craftlauncher.loading.mixin;

import io.craftlauncher.loading.LoadingConfig;
import io.craftlauncher.loading.LoadingRenderer;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.LoadingOverlay;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(LoadingOverlay.class)
public abstract class LoadingOverlayMixin {
    @Inject(
        method = "render(Lnet/minecraft/client/gui/GuiGraphics;IIF)V",
        at = @At("HEAD"),
        cancellable = true
    )
    private void craftlauncher$renderMinimal(GuiGraphics gui, int mouseX, int mouseY, float partialTick, CallbackInfo ci) {
        LoadingConfig cfg = LoadingConfig.get();
        if (!cfg.enabled) return;
        float progress = ((LoadingOverlayAccessor) this).craftlauncher$getCurrentProgress();
        LoadingRenderer.render(Minecraft.getInstance(), gui, partialTick, progress);
        ci.cancel();
    }
}
`;

const screenAccessor120 = `package io.craftlauncher.loading.mixin;

import java.util.List;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.components.Renderable;
import net.minecraft.client.gui.components.events.GuiEventListener;
import net.minecraft.client.gui.screens.Screen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;
import org.spongepowered.asm.mixin.gen.Invoker;

@Mixin(Screen.class)
public interface ScreenAccessor {
    @Accessor("minecraft")
    Minecraft craftlauncher$getMinecraft();

    @Accessor("children")
    List<GuiEventListener> craftlauncher$getChildren();

    @Accessor("renderables")
    List<Renderable> craftlauncher$getRenderables();

    @Invoker("addRenderableOnly")
    Renderable craftlauncher$addRenderableOnly(Renderable widget);
}
`;

const titleScreenDecorMixin119 = `package io.craftlauncher.loading.mixin;

import com.mojang.blaze3d.vertex.PoseStack;

import io.craftlauncher.client.ui.CraftMenu;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.renderer.texture.TextureManager;
import net.minecraft.resources.ResourceLocation;
import net.minecraftforge.client.ForgeHooksClient;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

@Mixin(TitleScreen.class)
public abstract class TitleScreenDecorMixin {
    private static final ResourceLocation BLANK = new ResourceLocation("craftlauncher", "textures/blank.png");

    @Redirect(
            method = "render(Lcom/mojang/blaze3d/vertex/PoseStack;IIF)V",
            at = @At(
                    value = "INVOKE",
                    target = "Lnet/minecraftforge/client/ForgeHooksClient;renderMainMenu(Lnet/minecraft/client/gui/screens/TitleScreen;Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/gui/Font;III)V"
            ),
            remap = false
    )
    private void craftlauncher$skipForgeBranding(
            TitleScreen gui, PoseStack poseStack, Font font, int width, int height, int alpha) {
        if (!CraftMenu.hideVanillaDecor()) {
            ForgeHooksClient.renderMainMenu(gui, poseStack, font, width, height, alpha);
        }
    }

    @Redirect(
            method = "render(Lcom/mojang/blaze3d/vertex/PoseStack;IIF)V",
            at = @At(
                    value = "INVOKE",
                    target = "Lnet/minecraft/client/renderer/texture/TextureManager;bindForSetup(Lnet/minecraft/resources/ResourceLocation;)V",
                    ordinal = 1
            )
    )
    private void craftlauncher$hideLogoTexture(TextureManager manager, ResourceLocation id) {
        manager.bindForSetup(CraftMenu.hideVanillaDecor() ? BLANK : id);
    }

    @Redirect(
            method = "render(Lcom/mojang/blaze3d/vertex/PoseStack;IIF)V",
            at = @At(
                    value = "INVOKE",
                    target = "Lnet/minecraft/client/renderer/texture/TextureManager;bindForSetup(Lnet/minecraft/resources/ResourceLocation;)V",
                    ordinal = 2
            )
    )
    private void craftlauncher$hideEditionTexture(TextureManager manager, ResourceLocation id) {
        manager.bindForSetup(CraftMenu.hideVanillaDecor() ? BLANK : id);
    }
}
`;

const titleScreenDecorMixin = `package io.craftlauncher.loading.mixin;

import io.craftlauncher.client.ui.CraftMenu;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.resources.ResourceLocation;
import net.minecraftforge.client.ForgeHooksClient;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

@Mixin(TitleScreen.class)
public abstract class TitleScreenDecorMixin {
    private static final ResourceLocation BLANK = new ResourceLocation("craftlauncher", "textures/blank.png");

    @Redirect(
            method = "render(Lnet/minecraft/client/gui/GuiGraphics;IIF)V",
            at = @At(
                    value = "INVOKE",
                    target = "Lnet/minecraftforge/client/ForgeHooksClient;renderMainMenu(Lnet/minecraft/client/gui/screens/TitleScreen;Lnet/minecraft/client/gui/GuiGraphics;Lnet/minecraft/client/gui/Font;III)V"
            ),
            remap = false
    )
    private static void craftlauncher$skipForgeBranding(
            TitleScreen gui, GuiGraphics graphics, Font font, int width, int height, int alpha) {
        if (!CraftMenu.hideVanillaDecor()) {
            ForgeHooksClient.renderMainMenu(gui, graphics, font, width, height, alpha);
        }
    }

    @Redirect(
            method = "render(Lnet/minecraft/client/gui/GuiGraphics;IIF)V",
            at = @At(
                    value = "INVOKE",
                    target = "Lnet/minecraft/client/gui/GuiGraphics;blit(Lnet/minecraft/resources/ResourceLocation;IIIIFFIIII)V",
                    ordinal = 0
            )
    )
    private void craftlauncher$hideLogo(GuiGraphics gui, ResourceLocation id, int x, int y, int w, int h,
            float u, float v, int tw, int th, int tileW, int tileH) {
        if (CraftMenu.hideVanillaDecor()) {
            gui.blit(BLANK, x, y, w, h, u, v, tw, th, tileW, tileH);
        } else {
            gui.blit(id, x, y, w, h, u, v, tw, th, tileW, tileH);
        }
    }
}
`;

const titleScreenDecorMixin121 = titleScreenDecorMixin.replace(
  'new ResourceLocation("craftlauncher", "textures/blank.png")',
  'ResourceLocation.fromNamespaceAndPath("craftlauncher", "textures/blank.png")',
);

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  for (const ver of ["1.20.1", "1.21.1"]) {
    applyPortMod120(ver);
  }
  console.log("✓ Port 1.20+ aplicado");
}
