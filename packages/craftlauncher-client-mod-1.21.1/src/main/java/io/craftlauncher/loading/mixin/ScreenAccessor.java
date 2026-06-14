package io.craftlauncher.loading.mixin;

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
