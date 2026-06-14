package io.craftlauncher.loading.mixin;

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
