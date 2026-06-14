package io.craftlauncher.loading.mixin;

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
