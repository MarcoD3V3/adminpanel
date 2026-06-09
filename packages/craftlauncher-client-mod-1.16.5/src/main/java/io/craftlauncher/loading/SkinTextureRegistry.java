package io.craftlauncher.loading;

import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.client.renderer.texture.NativeImage;
import net.minecraft.util.ResourceLocation;
import net.minecraftforge.fml.loading.FMLPaths;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

public final class SkinTextureRegistry {
    private static final Logger LOG = LogManager.getLogger();
    private static final String MOD_NS = "craftlauncher";
    private static final Map<String, ResourceLocation> CACHE = new HashMap<>();

    private SkinTextureRegistry() {}

    public static ResourceLocation resolve(String username) {
        if (username == null || username.isEmpty()) return null;
        String key = username.toLowerCase();
        ResourceLocation cached = CACHE.get(key);
        if (cached != null) return cached;

        String rel = SkinConfig.get().skinPathFor(key);
        return rel != null ? loadTexture(key, rel) : null;
    }

    public static ResourceLocation resolveLocalPlayer() {
        ResourceLocation cached = CACHE.get("__local__");
        if (cached != null) return cached;

        String rel = SkinConfig.get().resolveLocalSkinPath();
        return rel != null ? loadTexture("__local__", rel) : null;
    }

    private static ResourceLocation loadTexture(String cacheKey, String relPath) {
        Path file = FMLPaths.CONFIGDIR.get().resolve(relPath);
        if (!Files.isRegularFile(file)) {
            LOG.debug("[CraftLauncher] Skin no encontrada: {}", file);
            return null;
        }

        Minecraft mc = Minecraft.getInstance();
        if (mc == null || mc.getTextureManager() == null) {
            return null;
        }

        try {
            byte[] bytes = Files.readAllBytes(file);
            NativeImage image = NativeImage.read(new ByteArrayInputStream(bytes));
            DynamicTexture texture = new DynamicTexture(image);
            ResourceLocation id = new ResourceLocation(MOD_NS, "skins/" + cacheKey.replace(':', '_'));
            mc.getTextureManager().loadTexture(id, texture);
            CACHE.put(cacheKey, id);
            LOG.info("[CraftLauncher] Skin cargada: {} -> {}", cacheKey, file);
            return id;
        } catch (IOException ex) {
            LOG.warn("[CraftLauncher] No se pudo cargar skin {}: {}", file, ex.toString());
            return null;
        }
    }
}
