package io.craftlauncher.loading.mixin;

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
    private static final ResourceLocation BLANK = ResourceLocation.fromNamespaceAndPath("craftlauncher", "textures/blank.png");

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
