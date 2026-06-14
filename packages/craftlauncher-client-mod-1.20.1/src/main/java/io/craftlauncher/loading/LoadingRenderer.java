package io.craftlauncher.loading;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.util.Mth;

public final class LoadingRenderer {
    private LoadingRenderer() {}

    public static void render(Minecraft mc, GuiGraphics gui, float partialTick, float progress) {
        LoadingConfig cfg = LoadingConfig.get();
        int width = mc.getWindow().getGuiScaledWidth();
        int height = mc.getWindow().getGuiScaledHeight();

        int bg = parseColor(cfg.backgroundColor, 0xFF0a0b0d);
        gui.fill(0, 0, width, height, bg);

        var font = mc.font;
        if (cfg.brandText != null && !cfg.brandText.isBlank()) {
            String text = cfg.brandText.trim();
            int color = parseColor(cfg.brandColor, 0xFF8b8d92);
            gui.drawCenteredString(font, text, width / 2, (int) (height * 0.46f), color);
        }

        float clamped = Mth.clamp(progress, 0f, 1f);
        double ratio = cfg.progressWidthRatio <= 0 ? 0.42 : Math.min(1, cfg.progressWidthRatio);
        int barW = (int) (width * ratio);
        int barH = Math.max(2, cfg.progressHeight);
        int barX = (width - barW) / 2;
        int barY = (int) (height * 0.54f);

        int track = parseColor(cfg.progressTrackColor, 0xFF1a1d22);
        gui.fill(barX, barY, barX + barW, barY + barH, track);

        int fill = parseColor(cfg.progressColor, 0xFF6b9e78);
        int fillW = Math.max(0, (int) (barW * clamped));
        if (fillW > 0) {
            gui.fill(barX, barY, barX + fillW, barY + barH, fill);
        }
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
