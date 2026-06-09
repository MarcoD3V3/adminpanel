package io.craftlauncher.loading;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraftforge.fml.loading.FMLPaths;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

public final class LoadingConfig {
    private static final Logger LOG = LogManager.getLogger();
    private static final Gson GSON = new GsonBuilder().create();
    private static LoadingConfig INSTANCE = new LoadingConfig();

    public boolean enabled = true;
    public String backgroundColor = "#0a0b0d";
    public String progressColor = "#6b9e78";
    public String progressTrackColor = "#1a1d22";
    public String brandText = "CraftLauncher";
    public String brandColor = "#8b8d92";
    public int progressHeight = 3;
    public double progressWidthRatio = 0.42;

    public static LoadingConfig get() {
        return INSTANCE;
    }

    public static void load() {
        Path configPath = FMLPaths.CONFIGDIR.get().resolve("craftlauncher-loading-ui.json");
        if (!Files.isRegularFile(configPath)) {
            LOG.info("[CraftLauncher] Sin config en {}, usando valores por defecto", configPath);
            return;
        }
        try {
            String raw = new String(Files.readAllBytes(configPath), StandardCharsets.UTF_8);
            JsonObject root = new JsonParser().parse(raw).getAsJsonObject();
            LoadingConfig parsed = GSON.fromJson(raw, LoadingConfig.class);
            if (parsed == null) parsed = new LoadingConfig();

            if (root.has("backgroundColor") && !root.get("backgroundColor").isJsonNull()) {
                parsed.backgroundColor = root.get("backgroundColor").getAsString();
            }
            if (root.has("progress") && root.get("progress").isJsonObject()) {
                JsonObject prog = root.getAsJsonObject("progress");
                if (prog.has("enabled")) parsed.enabled = prog.get("enabled").getAsBoolean();
                if (prog.has("color")) parsed.progressColor = prog.get("color").getAsString();
                if (prog.has("trackColor")) parsed.progressTrackColor = prog.get("trackColor").getAsString();
                if (prog.has("height")) parsed.progressHeight = prog.get("height").getAsInt();
                if (prog.has("widthRatio")) parsed.progressWidthRatio = prog.get("widthRatio").getAsDouble();
            }
            if (root.has("elements") && root.get("elements").isJsonArray()) {
                for (JsonElement el : root.getAsJsonArray("elements")) {
                    if (!el.isJsonObject()) continue;
                    JsonObject o = el.getAsJsonObject();
                    if ("label".equals(getString(o, "type", ""))) {
                        parsed.brandText = getString(o, "text", parsed.brandText);
                        parsed.brandColor = getString(o, "textColor", parsed.brandColor);
                    }
                }
            }

            INSTANCE = parsed;
            LOG.info("[CraftLauncher] Config de carga cargada desde {}", configPath);
        } catch (IOException | RuntimeException ex) {
            LOG.warn("[CraftLauncher] No se pudo leer config de carga: {}", ex.toString());
        }
    }

    private static String getString(JsonObject o, String k, String d) {
        try {
            return o.has(k) && !o.get(k).isJsonNull() ? o.get(k).getAsString() : d;
        } catch (Throwable t) {
            return d;
        }
    }
}
