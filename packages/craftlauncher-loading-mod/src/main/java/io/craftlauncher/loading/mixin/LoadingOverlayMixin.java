package io.craftlauncher.loading.mixin;

import io.craftlauncher.loading.LoadingConfig;
import io.craftlauncher.loading.LoadingRenderer;
import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.LoadingOverlay;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(LoadingOverlay.class)
public abstract class LoadingOverlayMixin {
    @Inject(
        method = "render(Lcom/mojang/blaze3d/vertex/PoseStack;IIF)V",
        at = @At("RETURN")
    )
    private void craftlauncher$renderMinimal(PoseStack poseStack, int mouseX, int mouseY, float partialTick, CallbackInfo ci) {
        LoadingConfig cfg = LoadingConfig.get();
        if (!cfg.enabled) return;
        float progress = ((LoadingOverlayAccessor) this).craftlauncher$getCurrentProgress();
        LoadingRenderer.render(Minecraft.getInstance(), poseStack, partialTick, progress);
    }
}
