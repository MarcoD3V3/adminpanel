package io.craftlauncher.client.ui;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.network.chat.Component;

public class CraftButton extends Button {
    private final int bgColor;
    private final int hoverColor;
    private final int borderColor;
    private final int textColor;
    private final boolean drawBg;
    private final float textScale;
    private final boolean leftAlign;

    public CraftButton(int x, int y, int w, int h, Component msg, OnPress onPress,
                       int bgColor, int hoverColor, int borderColor, int textColor, boolean drawBg) {
        this(x, y, w, h, msg, onPress, bgColor, hoverColor, borderColor, textColor, drawBg, 1f, false);
    }

    public CraftButton(int x, int y, int w, int h, Component msg, OnPress onPress,
                       int bgColor, int hoverColor, int borderColor, int textColor, boolean drawBg,
                       float textScale, boolean leftAlign) {
        super(x, y, w, h, msg, onPress, DEFAULT_NARRATION);
        this.bgColor = bgColor;
        this.hoverColor = hoverColor;
        this.borderColor = borderColor;
        this.textColor = textColor;
        this.drawBg = drawBg;
        this.textScale = textScale;
        this.leftAlign = leftAlign;
    }

    @Override
    public void renderWidget(GuiGraphics gui, int mouseX, int mouseY, float partial) {
        int left = getX();
        int top = getY();
        int right = left + getWidth();
        int bottom = top + getHeight();
        if (drawBg) {
            int bg = isHoveredOrFocused() ? hoverColor : bgColor;
            gui.fill(left, top, right, bottom, bg);
            gui.fill(left, top, right, top + 1, borderColor);
            gui.fill(left, bottom - 1, right, bottom, borderColor);
            gui.fill(left, top, left + 1, bottom, borderColor);
            gui.fill(right - 1, top, right, bottom, borderColor);
        }
        var font = Minecraft.getInstance().font;
        String text = getMessage().getString();
        if (textScale != 1f) {
            gui.pose().pushPose();
            float cx = left + getWidth() / 2f;
            float cy = top + getHeight() / 2f;
            gui.pose().translate(cx, cy, 0);
            gui.pose().scale(textScale, textScale, 1f);
            gui.drawCenteredString(font, text, 0, -4, textColor);
            gui.pose().popPose();
        } else if (leftAlign) {
            gui.drawString(font, text, left + 2, top + (getHeight() - 8) / 2, textColor);
        } else {
            gui.drawCenteredString(font, text, left + getWidth() / 2, top + (getHeight() - 8) / 2, textColor);
        }
    }
}
