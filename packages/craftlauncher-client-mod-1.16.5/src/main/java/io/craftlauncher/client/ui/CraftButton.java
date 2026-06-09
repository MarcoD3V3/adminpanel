package io.craftlauncher.client.ui;

import com.mojang.blaze3d.matrix.MatrixStack;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.AbstractGui;
import net.minecraft.client.gui.FontRenderer;
import net.minecraft.client.gui.widget.button.Button;
import net.minecraft.util.text.ITextComponent;

public class CraftButton extends Button {
    private final int bgColor;
    private final int hoverColor;
    private final int borderColor;
    private final int textColor;
    private final boolean drawBg;
    private final float textScale;
    private final boolean leftAlign;

    public CraftButton(int x, int y, int w, int h, ITextComponent msg, IPressable onPress,
                       int bgColor, int hoverColor, int borderColor, int textColor, boolean drawBg) {
        this(x, y, w, h, msg, onPress, bgColor, hoverColor, borderColor, textColor, drawBg, 1f, false);
    }

    public CraftButton(int x, int y, int w, int h, ITextComponent msg, IPressable onPress,
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
    public void renderWidget(MatrixStack matrix, int mouseX, int mouseY, float partial) {
        if (drawBg) {
            int bg = this.isHovered() ? hoverColor : bgColor;
            AbstractGui.fill(matrix, this.x, this.y, this.x + this.width, this.y + this.height, bg);
            AbstractGui.fill(matrix, this.x, this.y, this.x + this.width, this.y + 1, borderColor);
            AbstractGui.fill(matrix, this.x, this.y + this.height - 1, this.x + this.width, this.y + this.height, borderColor);
            AbstractGui.fill(matrix, this.x, this.y, this.x + 1, this.y + this.height, borderColor);
            AbstractGui.fill(matrix, this.x + this.width - 1, this.y, this.x + this.width, this.y + this.height, borderColor);
        }
        FontRenderer font = Minecraft.getInstance().fontRenderer;
        String text = this.getMessage().getString();
        if (textScale != 1f) {
            matrix.push();
            float cx = this.x + this.width / 2f;
            float cy = this.y + this.height / 2f;
            matrix.translate(cx, cy, 0);
            matrix.scale(textScale, textScale, 1f);
            drawCenteredString(matrix, font, text, 0, -4, textColor);
            matrix.pop();
        } else if (leftAlign) {
            font.drawString(matrix, text, this.x + 2f, this.y + (this.height - 8) / 2f, textColor);
        } else {
            drawCenteredString(matrix, font, this.getMessage(), this.x + this.width / 2, this.y + (this.height - 8) / 2, textColor);
        }
    }
}
