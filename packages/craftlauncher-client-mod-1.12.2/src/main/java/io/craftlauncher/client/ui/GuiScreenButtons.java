package io.craftlauncher.client.ui;

import java.lang.reflect.Field;
import java.util.List;

import net.minecraft.client.gui.GuiButton;
import net.minecraft.client.gui.GuiScreen;
import net.minecraftforge.fml.relauncher.ReflectionHelper;

/** Acceso a buttonList en runtime ofuscado (Forge 1.12.2). */
final class GuiScreenButtons {
    private static final String[] BUTTON_LIST_NAMES = {"buttonList", "field_146292_n"};

    private GuiScreenButtons() {}

    @SuppressWarnings("unchecked")
    static List<GuiButton> list(GuiScreen screen) {
        try {
            return ReflectionHelper.getPrivateValue(GuiScreen.class, screen, BUTTON_LIST_NAMES);
        } catch (Throwable primary) {
            try {
                return findButtonListByType(screen);
            } catch (Throwable fallback) {
                IllegalStateException ex = new IllegalStateException("buttonList no accesible en GuiScreen", primary);
                ex.addSuppressed(fallback);
                throw ex;
            }
        }
    }

    @SuppressWarnings("unchecked")
    private static List<GuiButton> findButtonListByType(GuiScreen screen) throws IllegalAccessException {
        for (Field field : GuiScreen.class.getDeclaredFields()) {
            if (!List.class.isAssignableFrom(field.getType())) continue;
            field.setAccessible(true);
            Object value = field.get(screen);
            if (value instanceof List) {
                return (List<GuiButton>) value;
            }
        }
        throw new IllegalStateException("No se encontró ningún campo List en GuiScreen");
    }
}
