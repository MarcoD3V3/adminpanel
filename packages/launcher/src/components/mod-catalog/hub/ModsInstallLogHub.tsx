import { useEffect } from "react";
import { useLauncherDataStore } from "@/lib/launcher-data-store";
import { ensureModsBootstrapped } from "./mods-hub-bootstrap";

export function ModsInstallLogHub() {
  const installLogs = useLauncherDataStore((s) => s.installLogs);

  useEffect(() => {
    ensureModsBootstrapped();
  }, []);

  if (!installLogs.length) return null;

  return (
    <div className="lp-install-log">
      <p className="lp-install-log-title">Instalación</p>
      <div className="lp-install-log-body">
        {installLogs.slice(-6).map((log) => (
          <div key={log.id} className={`lp-log-line lp-log-${log.level}`}>
            <span className="lp-log-msg">{log.message}</span>
            {log.detail && <span className="lp-log-detail">{log.detail}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

