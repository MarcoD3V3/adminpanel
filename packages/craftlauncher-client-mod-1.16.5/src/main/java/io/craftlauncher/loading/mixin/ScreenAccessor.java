package io.craftlauncher.loading.mixin;

import java.util.List;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.Widget;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;
import org.spongepowered.asm.mixin.gen.Invoker;

@Mixin(Screen.class)
public interface ScreenAccessor {
    @Accessor("minecraft")
    Minecraft craftlauncher$getMinecraft();

    @Accessor("buttons")
    List<Widget> craftlauncher$getButtons();

    @Accessor("children")
    List<Widget> craftlauncher$getChildren();

    @Invoker("addButton")
    <T extends Widget> T craftlauncher$addButton(T widget);
}
