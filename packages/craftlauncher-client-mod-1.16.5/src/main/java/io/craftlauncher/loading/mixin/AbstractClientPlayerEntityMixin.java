package io.craftlauncher.loading.mixin;

import io.craftlauncher.loading.SkinTextureRegistry;
import net.minecraft.client.Minecraft;
import net.minecraft.client.entity.player.AbstractClientPlayerEntity;
import net.minecraft.util.ResourceLocation;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(AbstractClientPlayerEntity.class)
public abstract class AbstractClientPlayerEntityMixin {
    @Inject(method = "getLocationSkin", at = @At("HEAD"), cancellable = true)
    private void craftlauncher$overrideSkin(CallbackInfoReturnable<ResourceLocation> cir) {
        AbstractClientPlayerEntity self = (AbstractClientPlayerEntity) (Object) this;
        String name = self.getGameProfile().getName();
        ResourceLocation custom = SkinTextureRegistry.resolve(name);

        if (custom == null) {
            Minecraft mc = Minecraft.getInstance();
            if (mc != null && mc.player == self) {
                custom = SkinTextureRegistry.resolveLocalPlayer();
            }
        }

        if (custom != null) {
            cir.setReturnValue(custom);
        }
    }
}
