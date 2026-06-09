import { useEffect } from "react";
import { useLauncherDataStore } from "@/lib/launcher-data-store";
import { ModPreviewPane } from "../ModPreviewPane";
import { ensureModsBootstrapped } from "./mods-hub-bootstrap";

export function ModsPreviewHub() {
  const tab = useLauncherDataStore((s) => s.modTab);
  const preview = useLauncherDataStore((s) => s.modPreview);
  const installing = useLauncherDataStore((s) => s.installing);
  const activeInstance = useLauncherDataStore((s) => s.activeInstance);
  const installedMods = useLauncherDataStore((s) => s.installedMods);

  useEffect(() => {
    ensureModsBootstrapped();
  }, []);

  return (
    <ModPreviewPane
      tab={tab}
      preview={preview}
      installing={installing}
      hasActiveInstance={Boolean(activeInstance)}
      installedMods={installedMods}
      onClose={() => useLauncherDataStore.getState().clearModPreview()}
      onInstall={() => void useLauncherDataStore.getState().installPreview()}
    />
  );
}

