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
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

public final class SkinConfig {
    private static final Logger LOG = LogManager.getLogger();
    private static final Gson GSON = new GsonBuilder().create();
    private static SkinConfig INSTANCE = new SkinConfig();

    public int schema = 1;
    public String localUsername = "";
    public String minecraftUsername = "";
    public String localSkin = "";
    public Map<String, String> players = Collections.emptyMap();

    public static SkinConfig get() {
        return INSTANCE;
    }

    public static void load() {
        Path configPath = FMLPaths.CONFIGDIR.get().resolve("craftlauncher-skins.json");
        if (!Files.isRegularFile(configPath)) {
            LOG.info("[CraftLauncher] Sin skins en {}", configPath);
            return;
        }
        try {
            String raw = new String(Files.readAllBytes(configPath), StandardCharsets.UTF_8);
            JsonObject root = new JsonParser().parse(raw).getAsJsonObject();
            SkinConfig parsed = GSON.fromJson(raw, SkinConfig.class);
            if (parsed == null) parsed = new SkinConfig();

            if (root.has("localUsername") && !root.get("localUsername").isJsonNull()) {
                parsed.localUsername = root.get("localUsername").getAsString().toLowerCase();
            }
            if (root.has("minecraftUsername") && !root.get("minecraftUsername").isJsonNull()) {
                parsed.minecraftUsername = root.get("minecraftUsername").getAsString().toLowerCase();
            }
            if (root.has("localSkin") && !root.get("localSkin").isJsonNull()) {
                parsed.localSkin = root.get("localSkin").getAsString();
            }

            Map<String, String> map = new HashMap<>();
            if (root.has("players") && root.get("players").isJsonObject()) {
                for (Map.Entry<String, JsonElement> e : root.getAsJsonObject("players").entrySet()) {
                    if (e.getValue() == null || e.getValue().isJsonNull()) continue;
                    String key = e.getKey().toLowerCase();
                    String rel = e.getValue().getAsString();
                    if (!key.isEmpty() && rel != null && !rel.isEmpty()) {
                        map.put(key, rel);
                    }
                }
            }
            parsed.players = map;
            INSTANCE = parsed;
            LOG.info("[CraftLauncher] Skins cargadas: {} jugador(es)", map.size());
        } catch (IOException | RuntimeException ex) {
            LOG.warn("[CraftLauncher] No se pudo leer craftlauncher-skins.json: {}", ex.toString());
        }
    }

    public String skinPathFor(String username) {
        if (username == null) return null;
        return players.get(username.toLowerCase());
    }

    public String resolveLocalSkinPath() {
        if (localSkin != null && !localSkin.isEmpty()) return localSkin;
        if (minecraftUsername != null && !minecraftUsername.isEmpty()) {
            String byMc = skinPathFor(minecraftUsername);
            if (byMc != null) return byMc;
        }
        if (localUsername != null && !localUsername.isEmpty()) {
            return skinPathFor(localUsername);
        }
        return null;
    }
}
