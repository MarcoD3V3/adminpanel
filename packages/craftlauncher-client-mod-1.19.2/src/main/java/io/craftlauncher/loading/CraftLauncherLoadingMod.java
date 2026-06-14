package io.craftlauncher.loading;

import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.loading.FMLEnvironment;

@Mod(CraftLauncherLoadingMod.MOD_ID)
public class CraftLauncherLoadingMod {
    public static final String MOD_ID = "craftlauncher_loading";

    public CraftLauncherLoadingMod() {
        if (FMLEnvironment.dist.isClient()) {
            LoadingConfig.load();
        }
    }
}
