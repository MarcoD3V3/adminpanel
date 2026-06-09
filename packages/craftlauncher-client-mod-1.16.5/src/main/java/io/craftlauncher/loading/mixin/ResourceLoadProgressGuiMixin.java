package io.craftlauncher.loading.mixin;

import com.mojang.blaze3d.matrix.MatrixStack;
import io.craftlauncher.loading.LoadingConfig;
import io.craftlauncher.loading.LoadingRenderer;
import net.minecraft.client.gui.ResourceLoadProgressGui;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(ResourceLoadProgressGui.class)
public abstract class ResourceLoadProgressGuiMixin {
    @Shadow
    private float progress;

    @Inject(
        method = "render(Lcom/mojang/blaze3d/matrix/MatrixStack;IIF)V",
        at = @At("HEAD"),
        cancellable = true
    )
    private void craftlauncher$render(MatrixStack matrix, int mouseX, int mouseY, float partialTick, CallbackInfo ci) {
        LoadingConfig cfg = LoadingConfig.get();
        if (!cfg.enabled) return;
        LoadingRenderer.render(net.minecraft.client.Minecraft.getInstance(), matrix, partialTick, this.progress);
        ci.cancel();
    }
}
