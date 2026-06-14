package io.craftlauncher.loading;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.mojang.logging.LogUtils;
import net.minecraftforge.fml.loading.FMLPaths;
import org.slf4j.Logger;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

public final class LoadingConfig {
    private static final Logger LOG = LogUtils.getLogger();
    private static final Gson GSON = new GsonBuilder().create();
    private static LoadingConfig INSTANCE = new LoadingConfig();

    public boolean enabled = true;
    public String backgroundColor = "#0a0b0d";
    public String progressColor = "#6b9e78";
    public String progressTrackColor = "#1a1d22";
    public String brandText = "CraftLauncher";
    public String brandColor = "#8b8d92";
    public boolean hideMojangLogo = true;
    public int progressHeight = 3;
    public double progressWidthRatio = 0.42;

    public static LoadingConfig get() {
        return INSTANCE;
    }

    public static void load() {
        Path configPath = FMLPaths.CONFIGDIR.get().resolve("craftlauncher-loading-ui.json");
        if (!Files.isRegularFile(configPath)) {
            LOG.info("[CraftLauncher Loading] Sin config en {}, usando valores por defecto", configPath);
            return;
        }
        try {
            String raw = Files.readString(configPath, StandardCharsets.UTF_8);
            LoadingConfig parsed = GSON.fromJson(raw, LoadingConfig.class);
            if (parsed != null) {
                INSTANCE = parsed;
                LOG.info("[CraftLauncher Loading] Config cargada desde {}", configPath);
            }
        } catch (IOException | RuntimeException ex) {
            LOG.warn("[CraftLauncher Loading] No se pudo leer config: {}", ex.toString());
        }
    }
}
