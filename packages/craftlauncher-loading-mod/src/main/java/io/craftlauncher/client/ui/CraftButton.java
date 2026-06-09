package io.craftlauncher.client.ui;

import com.mojang.blaze3d.vertex.PoseStack;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.components.Button;
import net.minecraft.network.chat.Component;

/**
 * Botón plano con estilo configurable (fondo, hover, borde, color de texto).
 * Si drawBg=false se usa como etiqueta de texto (no dibuja caja).
 */
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
        super(x, y, w, h, msg, onPress);
        this.bgColor = bgColor;
        this.hoverColor = hoverColor;
        this.borderColor = borderColor;
        this.textColor = textColor;
        this.drawBg = drawBg;
        this.textScale = textScale;
        this.leftAlign = leftAlign;
    }

    @Override
    public void renderButton(PoseStack pose, int mouseX, int mouseY, float partial) {
        if (drawBg) {
            int bg = this.isHoveredOrFocused() ? hoverColor : bgColor;
            fill(pose, this.x, this.y, this.x + this.width, this.y + this.height, bg);
            fill(pose, this.x, this.y, this.x + this.width, this.y + 1, borderColor);
            fill(pose, this.x, this.y + this.height - 1, this.x + this.width, this.y + this.height, borderColor);
            fill(pose, this.x, this.y, this.x + 1, this.y + this.height, borderColor);
            fill(pose, this.x + this.width - 1, this.y, this.x + this.width, this.y + this.height, borderColor);
        }
        Font font = Minecraft.getInstance().font;
        String text = this.getMessage().getString();
        if (textScale != 1f) {
            pose.pushPose();
            float cx = this.x + this.width / 2f;
            float cy = this.y + this.height / 2f;
            pose.translate(cx, cy, 0);
            pose.scale(textScale, textScale, 1f);
            drawCenteredString(pose, font, text, 0, -4, textColor);
            pose.popPose();
        } else if (leftAlign) {
            font.draw(pose, text, this.x + 2, this.y + (this.height - 8) / 2, textColor);
        } else {
            drawCenteredString(pose, font, text, this.x + this.width / 2, this.y + (this.height - 8) / 2, textColor);
        }
    }
}
