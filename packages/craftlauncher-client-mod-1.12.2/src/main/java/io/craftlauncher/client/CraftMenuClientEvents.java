package io.craftlauncher.client;

import io.craftlauncher.client.ui.CraftMenu;
import io.craftlauncher.loading.CraftLauncherLoadingMod;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Gui;
import net.minecraft.client.gui.GuiMainMenu;
import net.minecraftforge.client.event.GuiScreenEvent;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.common.eventhandler.EventPriority;
import net.minecraftforge.fml.common.eventhandler.SubscribeEvent;
import net.minecraftforge.fml.common.gameevent.TickEvent;
import net.minecraftforge.fml.relauncher.Side;

/**
 * Forge 1.12.2 no aplica mixins del manifest sin bootstrap extra;
 * el menú personalizado se engancha por eventos.
 */
@Mod.EventBusSubscriber(modid = CraftLauncherLoadingMod.MOD_ID, value = Side.CLIENT)
public final class CraftMenuClientEvents {
    private static final int MENU_BG = 0xFF000000;

    private CraftMenuClientEvents() {}

    @SubscribeEvent
    public static void onInitGuiPost(GuiScreenEvent.InitGuiEvent.Post event) {
        if (event.getGui() instanceof GuiMainMenu) {
            CraftMenu.build((GuiMainMenu) event.getGui());
        }
    }

    /**
     * Sustituye panorama, logo, splash y textos Forge por fondo liso + botones del JSON.
     */
    @SubscribeEvent(priority = EventPriority.HIGH)
    public static void onDrawScreenPre(GuiScreenEvent.DrawScreenEvent.Pre event) {
        if (!(event.getGui() instanceof GuiMainMenu) || !CraftMenu.hideVanillaDecor()) return;

        event.setCanceled(true);
        GuiMainMenu menu = (GuiMainMenu) event.getGui();
        int w = menu.width;
        int h = menu.height;
        Gui.drawRect(0, 0, w, h, MENU_BG);

        float partial = Minecraft.getMinecraft().getRenderPartialTicks();
        CraftMenu.render(menu, event.getMouseX(), event.getMouseY(), partial);
    }

    @SubscribeEvent
    public static void onClientTick(TickEvent.ClientTickEvent event) {
        if (event.phase != TickEvent.Phase.END) return;
        net.minecraft.client.Minecraft mc = net.minecraft.client.Minecraft.getMinecraft();
        if (mc.currentScreen instanceof GuiMainMenu) {
            CraftMenu.tick((GuiMainMenu) mc.currentScreen);
        }
    }
}
