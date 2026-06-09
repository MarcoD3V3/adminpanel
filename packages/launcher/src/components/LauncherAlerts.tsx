import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

import { launcherActions, useLauncherStore } from "@/lib/launcher-store";



const icons = {

  info: Info,

  warning: AlertTriangle,

  success: CheckCircle2,

  error: AlertTriangle,

  alert: AlertTriangle,

  update: Info,

};



export function LauncherAlerts() {

  const alerts = useLauncherStore((s) => s.modalAlerts);



  if (!alerts.length) return null;



  const current = alerts[0];

  const Icon = icons[current.style] ?? Info;



  return (

    <div className="alert-overlay" role="alertdialog" aria-modal="true">

      <div className={`alert-modal alert-${current.style}`}>

        <Icon size={28} className="alert-icon" />

        <h2 className="alert-title">{current.title}</h2>

        <p className="alert-message">{current.message}</p>

        <button type="button" className="alert-btn" onClick={() => launcherActions.dismissModalAlert(current.id)}>

          Entendido

        </button>

      </div>

    </div>

  );

}


