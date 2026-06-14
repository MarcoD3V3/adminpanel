package io.craftlauncher.loading.mixin;

import io.craftlauncher.client.ui.CraftMenu;
import net.minecraft.client.gui.screens.TitleScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(TitleScreen.class)
public abstract class TitleScreenMixin {
    @Inject(method = "init", at = @At("RETURN"))
    private void craftlauncher$initAfter(CallbackInfo ci) {
        CraftMenu.build((TitleScreen) (Object) this);
    }

    @Inject(method = "tick", at = @At("HEAD"))
    private void craftlauncher$tick(CallbackInfo ci) {
        CraftMenu.tick((TitleScreen) (Object) this);
    }
}
