import type { LogicTrigger } from "../types/hub-layout";

/** Fases del lanzamiento (alineado con el store del launcher). */
export type LaunchAutomationPhase =
  | "idle"
  | "checking"
  | "preparing"
  | "downloading"
  | "starting"
  | "running"
  | "error"
  | "closed";

const ACTIVE_PHASES = new Set<LaunchAutomationPhase>([
  "checking",
  "preparing",
  "downloading",
  "starting",
]);

export function isLaunchActivePhase(phase: LaunchAutomationPhase): boolean {
  return ACTIVE_PHASES.has(phase);
}

export function isLaunchIdlePhase(phase: LaunchAutomationPhase): boolean {
  return phase === "idle" || phase === "closed";
}

/** ¿Debe ejecutarse este disparador al pasar de prev → next? (solo flancos, no en cada tick). */
export function shouldRunLogicTrigger(
  trigger: LogicTrigger,
  prev: LaunchAutomationPhase,
  next: LaunchAutomationPhase
): boolean {
  if (prev === next) return false;

  switch (trigger) {
    case "phase-change":
      return true;
    case "launch-idle":
      return isLaunchIdlePhase(next) && !isLaunchIdlePhase(prev);
    case "launch-active":
      return isLaunchActivePhase(next) && !isLaunchActivePhase(prev);
    case "launch-running":
      return next === "running" && prev !== "running";
    case "launch-error":
      return next === "error" && prev !== "error";
    case "launch-ended":
      return (
        isLaunchIdlePhase(next) &&
        (prev === "running" || isLaunchActivePhase(prev) || prev === "error")
      );
    default:
      return false;
  }
}

/** Fase requerida para contenedor `visibility-zone` (value o constante PHASE). */
export function visibilityZoneMatches(
  required: string | undefined,
  phase: LaunchAutomationPhase
): boolean {
  const key = String(required ?? "any").trim().toLowerCase();
  if (!key || key === "any" || key === "*") return true;
  if (key === "idle") return isLaunchIdlePhase(phase);
  if (key === "launching" || key === "active") return isLaunchActivePhase(phase);
  if (key === "running" || key === "ingame" || key === "en-juego") return phase === "running";
  if (key === "error") return phase === "error";
  return phase === key;
}

export const EVENT_LOGIC_TRIGGERS: LogicTrigger[] = [
  "phase-change",
  "launch-idle",
  "launch-active",
  "launch-running",
  "launch-error",
  "launch-ended",
];

/** Disparadores que aplican mientras la fase actual se mantiene (re-sincronizar UI). */
export function triggersMatchingPhase(phase: LaunchAutomationPhase): LogicTrigger[] {
  const out: LogicTrigger[] = [];
  if (isLaunchActivePhase(phase)) out.push("launch-active");
  if (isLaunchIdlePhase(phase)) out.push("launch-idle");
  if (phase === "running") out.push("launch-running");
  if (phase === "error") out.push("launch-error");
  return out;
}
