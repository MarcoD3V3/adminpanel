import { X } from "lucide-react";
import { launcherActions, useLauncherStore } from "@/lib/launcher-store";

export function LauncherBanners() {
  const banners = useLauncherStore((s) => s.banners);

  if (!banners.length) return null;

  return (
    <div className="banners">
      {banners.map((b) => (
        <div key={b.id} className={`banner banner-${b.style}`}>
          <div className="banner-text">
          <strong>{b.title}</strong> — {b.message}
        </div>
          <button type="button" onClick={() => launcherActions.dismissBanner(b.id)} aria-label="Cerrar">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
