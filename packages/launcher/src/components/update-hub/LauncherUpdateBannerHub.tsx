"use client";

import { Download, X } from "lucide-react";
import { useLauncherStore, launcherActions } from "@/lib/launcher-store";
import { getLauncherApi } from "@/lib/electron-api";

const DISMISS_PREFIX = "cl_dismissed_update_";

export function LauncherUpdateBannerHub({ label }: { label?: string }) {
  const update = useLauncherStore((s) => s.launcherUpdate);

  if (!update?.available) return null;

  const dismissKey = `${DISMISS_PREFIX}${update.latestVersion}`;
  try {
    if (localStorage.getItem(dismissKey) === "1") return null;
  } catch {
    /* private mode */
  }

  const openDownload = () => {
    const url = update.downloadUrl?.trim();
    if (!url) return;
    void getLauncherApi()?.openExternal?.(url);
  };

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey, "1");
    } catch {
      /* ignore */
    }
    launcherActions.dismissLauncherUpdateBanner();
  };

  return (
    <div className="launcher-update-banner" role="status">
      <div className="launcher-update-banner-body">
        <p className="launcher-update-banner-title">
          {label?.trim() || "Nueva actualización disponible"}
        </p>
        <p className="launcher-update-banner-msg">
          v{update.latestVersion} publicada · tienes v{update.currentVersion}. Puedes seguir jugando;
          {update.belowMinimum
            ? " algunas funciones nuevas requieren la última versión."
            : " actualiza cuando quieras."}
        </p>
      </div>
      <div className="launcher-update-banner-actions">
        {update.downloadUrl ? (
          <button type="button" className="launcher-update-banner-dl" onClick={openDownload}>
            <Download size={14} aria-hidden />
            Descargar
          </button>
        ) : null}
        <button type="button" className="launcher-update-banner-dismiss" onClick={dismiss} aria-label="Ocultar">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
