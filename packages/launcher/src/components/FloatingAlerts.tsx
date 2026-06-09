import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { launcherActions, useLauncherStore } from "@/lib/launcher-store";

const icons = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  error: AlertTriangle,
  alert: AlertTriangle,
  update: Info,
};

function formatLine(title: string, message: string): string {
  const t = title.trim();
  const m = message.trim();
  if (t && m) return `${t} — ${m}`;
  return t || m;
}

export function FloatingAlerts() {
  const alerts = useLauncherStore((s) => s.floatingAlerts);

  if (!alerts.length) return null;

  return (
    <div className="floating-alerts" aria-live="polite">
      {alerts.map((alert) => {
        const Icon = icons[alert.style] ?? Info;
        return (
          <div key={alert.id} className={`floating-alert floating-alert-${alert.style}`} role="alert">
            <Icon size={18} className="floating-alert-icon" strokeWidth={1.75} />
            <div className="floating-alert-body">
              <p className="floating-alert-line">{formatLine(alert.title, alert.message)}</p>
            </div>
            <button
              type="button"
              className="floating-alert-close"
              onClick={() => launcherActions.dismissFloatingAlert(alert.id)}
              aria-label="Cerrar"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
