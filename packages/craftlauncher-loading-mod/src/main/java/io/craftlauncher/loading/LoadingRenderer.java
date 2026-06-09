package io.craftlauncher.loading;

import com.mojang.blaze3d.systems.RenderSystem;
import com.mojang.blaze3d.vertex.BufferBuilder;
import com.mojang.blaze3d.vertex.DefaultVertexFormat;
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.Tesselator;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.renderer.GameRenderer;
import net.minecraft.util.Mth;
import com.mojang.math.Matrix4f;

public final class LoadingRenderer {
    private LoadingRenderer() {}

    public static void render(Minecraft mc, PoseStack poseStack, float partialTick, float progress) {
        LoadingConfig cfg = LoadingConfig.get();
        int width = mc.getWindow().getGuiScaledWidth();
        int height = mc.getWindow().getGuiScaledHeight();

        int bg = parseColor(cfg.backgroundColor, 0xFF0a0b0d);
        fillRect(poseStack, 0, 0, width, height, bg);

        Font font = mc.font;
        if (cfg.brandText != null && !cfg.brandText.isBlank()) {
            String text = cfg.brandText.trim();
            int tw = font.width(text);
            int color = parseColor(cfg.brandColor, 0xFF8b8d92);
            font.draw(poseStack, text, (width - tw) / 2f, height * 0.46f, color);
        }

        float clamped = Mth.clamp(progress, 0f, 1f);
        double ratio = cfg.progressWidthRatio <= 0 ? 0.42 : Math.min(1, cfg.progressWidthRatio);
        int barW = (int) (width * ratio);
        int barH = Math.max(2, cfg.progressHeight);
        int barX = (width - barW) / 2;
        int barY = (int) (height * 0.54f);

        int track = parseColor(cfg.progressTrackColor, 0xFF1a1d22);
        fillRect(poseStack, barX, barY, barW, barH, track);

        int fill = parseColor(cfg.progressColor, 0xFF6b9e78);
        int fillW = Math.max(0, (int) (barW * clamped));
        if (fillW > 0) {
            fillRect(poseStack, barX, barY, fillW, barH, fill);
        }
    }

    private static void fillRect(PoseStack poseStack, int x, int y, int w, int h, int argb) {
        float a = ((argb >> 24) & 0xFF) / 255f;
        float r = ((argb >> 16) & 0xFF) / 255f;
        float g = ((argb >> 8) & 0xFF) / 255f;
        float b = (argb & 0xFF) / 255f;

        RenderSystem.disableDepthTest();
        RenderSystem.enableBlend();
        RenderSystem.defaultBlendFunc();
        RenderSystem.setShader(GameRenderer::getPositionColorShader);

        Matrix4f matrix = poseStack.last().pose();
        BufferBuilder buffer = Tesselator.getInstance().getBuilder();
        buffer.begin(com.mojang.blaze3d.vertex.VertexFormat.Mode.QUADS, DefaultVertexFormat.POSITION_COLOR);
        buffer.vertex(matrix, x, y + h, 0).color(r, g, b, a).endVertex();
        buffer.vertex(matrix, x + w, y + h, 0).color(r, g, b, a).endVertex();
        buffer.vertex(matrix, x + w, y, 0).color(r, g, b, a).endVertex();
        buffer.vertex(matrix, x, y, 0).color(r, g, b, a).endVertex();
        Tesselator.getInstance().end();
        RenderSystem.disableBlend();
        RenderSystem.enableDepthTest();
    }

    static int parseColor(String hex, int fallback) {
        if (hex == null || hex.isBlank()) return fallback | 0xFF000000;
        String s = hex.trim();
        if (s.startsWith("#")) s = s.substring(1);
        if (s.length() == 6) {
            try {
                return 0xFF000000 | Integer.parseInt(s, 16);
            } catch (NumberFormatException ignored) {
                return fallback | 0xFF000000;
            }
        }
        return fallback | 0xFF000000;
    }
}
