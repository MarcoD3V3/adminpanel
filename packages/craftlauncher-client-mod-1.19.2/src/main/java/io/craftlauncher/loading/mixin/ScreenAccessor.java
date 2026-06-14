package io.craftlauncher.loading.mixin;

import java.util.List;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.components.Widget;
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
    List<?> craftlauncher$getRenderables();

    @Invoker("addRenderableOnly")
    Widget craftlauncher$addRenderableOnly(Widget widget);
}
