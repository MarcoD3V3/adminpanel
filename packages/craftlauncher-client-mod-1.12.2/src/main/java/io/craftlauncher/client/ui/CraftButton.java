package io.craftlauncher.client.ui;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.FontRenderer;
import net.minecraft.client.gui.GuiButton;
import net.minecraft.client.renderer.GlStateManager;

public class CraftButton extends GuiButton {
    @FunctionalInterface
    public interface PressAction {
        void onPress(CraftButton button);
    }

    private final PressAction pressAction;
    private final int bgColor;
    private final int hoverColor;
    private final int borderColor;
    private final int textColor;
    private final boolean drawBg;
    private final float textScale;
    private final boolean leftAlign;

    public CraftButton(int x, int y, int w, int h, String msg, PressAction onPress,
                       int bgColor, int hoverColor, int borderColor, int textColor, boolean drawBg) {
        this(x, y, w, h, msg, onPress, bgColor, hoverColor, borderColor, textColor, drawBg, 1f, false);
    }

    public CraftButton(int x, int y, int w, int h, String msg, PressAction onPress,
                       int bgColor, int hoverColor, int borderColor, int textColor, boolean drawBg,
                       float textScale, boolean leftAlign) {
        super(0, x, y, w, h, msg);
        this.pressAction = onPress;
        this.bgColor = bgColor;
        this.hoverColor = hoverColor;
        this.borderColor = borderColor;
        this.textColor = textColor;
        this.drawBg = drawBg;
        this.textScale = textScale;
        this.leftAlign = leftAlign;
    }

    @Override
    public void drawButton(Minecraft mc, int mouseX, int mouseY, float partialTicks) {
        if (!this.visible) return;

        this.hovered = mouseX >= this.x && mouseY >= this.y
                && mouseX < this.x + this.width && mouseY < this.y + this.height;

        if (drawBg) {
            int bg = this.hovered ? hoverColor : bgColor;
            drawRect(this.x, this.y, this.x + this.width, this.y + this.height, bg);
            drawRect(this.x, this.y, this.x + this.width, this.y + 1, borderColor);
            drawRect(this.x, this.y + this.height - 1, this.x + this.width, this.y + this.height, borderColor);
            drawRect(this.x, this.y, this.x + 1, this.y + this.height, borderColor);
            drawRect(this.x + this.width - 1, this.y, this.x + this.width, this.y + this.height, borderColor);
        }

        FontRenderer font = mc.fontRenderer;
        String text = this.displayString;
        if (textScale != 1f) {
            GlStateManager.pushMatrix();
            float cx = this.x + this.width / 2f;
            float cy = this.y + this.height / 2f;
            GlStateManager.translate(cx, cy, 0);
            GlStateManager.scale(textScale, textScale, 1f);
            drawCenteredString(font, text, 0, -4, textColor);
            GlStateManager.popMatrix();
        } else if (leftAlign) {
            font.drawString(text, this.x + 2, this.y + (this.height - 8) / 2, textColor);
        } else {
            drawCenteredString(font, text, this.x + this.width / 2, this.y + (this.height - 8) / 2, textColor);
        }
    }

    @Override
    public boolean mousePressed(Minecraft mc, int mouseX, int mouseY) {
        if (this.enabled && this.visible && this.hovered) {
            this.playPressSound(mc.getSoundHandler());
            if (pressAction != null) {
                pressAction.onPress(this);
            }
            return true;
        }
        return false;
    }
}
