package io.craftlauncher.loading.mixin;

import io.craftlauncher.client.ui.CraftMenu;
import net.minecraft.client.gui.screen.MainMenuScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(MainMenuScreen.class)
public abstract class TitleScreenMixin {
    /** Deja que vanilla inicialice splash, panorama, notificaciones Forge, etc. */
    @Inject(method = "init", at = @At("RETURN"))
    private void craftlauncher$initAfter(CallbackInfo ci) {
        CraftMenu.build((MainMenuScreen) (Object) this);
    }

    @Inject(method = "tick", at = @At("HEAD"))
    private void craftlauncher$tick(CallbackInfo ci) {
        CraftMenu.tick((MainMenuScreen) (Object) this);
    }
}
