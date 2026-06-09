package io.craftlauncher.loading.mixin;

import java.util.function.BiConsumer;

import com.mojang.blaze3d.matrix.MatrixStack;

import io.craftlauncher.client.ui.CraftMenu;
import net.minecraft.client.gui.FontRenderer;
import net.minecraft.client.gui.screen.MainMenuScreen;
import net.minecraft.client.renderer.texture.TextureManager;
import net.minecraft.util.ResourceLocation;
import net.minecraftforge.client.ForgeHooksClient;
import net.minecraftforge.client.gui.NotificationModUpdateScreen;
import net.minecraftforge.fml.BrandingControl;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

/** Oculta logo y textos Forge del menú vanilla cuando el JSON lo pide. */
@Mixin(MainMenuScreen.class)
public abstract class TitleScreenDecorMixin {
    private static final ResourceLocation BLANK = new ResourceLocation("craftlauncher", "textures/blank.png");

    @Redirect(
            method = "render(Lcom/mojang/blaze3d/matrix/MatrixStack;IIF)V",
            at = @At(
                    value = "INVOKE",
                    target = "Lnet/minecraftforge/client/ForgeHooksClient;renderMainMenu(Lnet/minecraft/client/gui/screen/MainMenuScreen;Lcom/mojang/blaze3d/matrix/MatrixStack;Lnet/minecraft/client/gui/FontRenderer;III)V"
            ),
            remap = false
    )
    private void craftlauncher$skipForgeBranding(
            MainMenuScreen gui, MatrixStack matrix, FontRenderer font, int width, int height, int alpha) {
        if (!CraftMenu.hideVanillaDecor()) {
            ForgeHooksClient.renderMainMenu(gui, matrix, font, width, height, alpha);
        }
    }

    @Redirect(
            method = "render(Lcom/mojang/blaze3d/matrix/MatrixStack;IIF)V",
            at = @At(
                    value = "INVOKE",
                    target = "Lnet/minecraftforge/fml/BrandingControl;forEachLine(ZZLjava/util/function/BiConsumer;)V"
            ),
            remap = false
    )
    private void craftlauncher$skipBrandingLines(
            boolean drawBottom, boolean drawMc, BiConsumer<Integer, String> consumer) {
        if (!CraftMenu.hideVanillaDecor()) {
            BrandingControl.forEachLine(drawBottom, drawMc, consumer);
        }
    }

    @Redirect(
            method = "render(Lcom/mojang/blaze3d/matrix/MatrixStack;IIF)V",
            at = @At(
                    value = "INVOKE",
                    target = "Lnet/minecraftforge/fml/BrandingControl;forEachAboveCopyrightLine(Ljava/util/function/BiConsumer;)V"
            ),
            remap = false
    )
    private void craftlauncher$skipUpdateLine(BiConsumer<Integer, String> consumer) {
        if (!CraftMenu.hideVanillaDecor()) {
            BrandingControl.forEachAboveCopyrightLine(consumer);
        }
    }

    @Redirect(
            method = "render(Lcom/mojang/blaze3d/matrix/MatrixStack;IIF)V",
            at = @At(
                    value = "INVOKE",
                    target = "Lnet/minecraftforge/client/gui/NotificationModUpdateScreen;render(Lcom/mojang/blaze3d/matrix/MatrixStack;IIF)V"
            ),
            remap = false
    )
    private void craftlauncher$skipModUpdate(
            NotificationModUpdateScreen screen, MatrixStack matrix, int mouseX, int mouseY, float partial) {
        if (!CraftMenu.hideVanillaDecor()) {
            screen.render(matrix, mouseX, mouseY, partial);
        }
    }

    @Redirect(
            method = "render(Lcom/mojang/blaze3d/matrix/MatrixStack;IIF)V",
            at = @At(
                    value = "INVOKE",
                    target = "Lnet/minecraft/client/renderer/texture/TextureManager;bindTexture(Lnet/minecraft/util/ResourceLocation;)V",
                    ordinal = 1
            )
    )
    private void craftlauncher$hideLogoTexture(TextureManager manager, ResourceLocation id) {
        manager.bindTexture(CraftMenu.hideVanillaDecor() ? BLANK : id);
    }

    @Redirect(
            method = "render(Lcom/mojang/blaze3d/matrix/MatrixStack;IIF)V",
            at = @At(
                    value = "INVOKE",
                    target = "Lnet/minecraft/client/renderer/texture/TextureManager;bindTexture(Lnet/minecraft/util/ResourceLocation;)V",
                    ordinal = 2
            )
    )
    private void craftlauncher$hideEditionTexture(TextureManager manager, ResourceLocation id) {
        manager.bindTexture(CraftMenu.hideVanillaDecor() ? BLANK : id);
    }
}
