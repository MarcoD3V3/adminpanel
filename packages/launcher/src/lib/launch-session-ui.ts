import type { LaunchPhase } from "./launcher-store";

export interface ParsedLogLine {
  kind: string | null;
  current: number;
  total: number;
  raw: string;
  ratio: number | null;
}

const KIND_LABELS: Record<string, string> = {
  assets: "Atlas",
  classes: "Bytecode",
  libraries: "Librerías",
  natives: "Nativos",
  forge: "Forge",
  version: "Versión",
  java: "Java",
};

export function parseLogLine(line: string): ParsedLogLine {
  const m = line.match(/^([\w-]+):\s*(\d+)\/(\d+)/i);
  if (!m) return { kind: null, current: 0, total: 0, raw: line, ratio: null };
  const current = Number(m[2]);
  const total = Number(m[3]);
  return {
    kind: m[1].toLowerCase(),
    current,
    total,
    raw: line,
    ratio: total > 0 ? Math.min(1, current / total) : null,
  };
}

export function kindLabel(kind: string) {
  return KIND_LABELS[kind.toLowerCase()] ?? kind;
}

export function formatEta(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 45) return `~${Math.max(1, Math.ceil(seconds))}s`;
  const mins = Math.ceil(seconds / 60);
  return mins === 1 ? "~1 min" : `~${mins} min`;
}

export function formatVelocity(velocityPerMin: number) {
  if (!Number.isFinite(velocityPerMin) || velocityPerMin <= 0.05) return null;
  return `+${velocityPerMin.toFixed(1)}%/min`;
}

export function formatItemsPerMin(current: number, startedAt: number) {
  if (!startedAt || current <= 0) return null;
  const mins = (Date.now() - startedAt) / 60_000;
  if (mins < 0.15) return null;
  const rate = Math.round(current / mins);
  return rate > 0 ? `${rate.toLocaleString()} u/min` : null;
}

const MILESTONES = [
  { at: 25, text: "Primer cuarto del atlas — sigue en silencio, sin prisa" },
  { at: 50, text: "Mitad del camino. Ocultar no cancela nada" },
  { at: 75, text: "Tres cuartos. El perfil casi respira" },
  { at: 90, text: "Último tramo antes de abrir el juego" },
] as const;

export function nextMilestoneWhisper(percent: number, lastMilestone: number) {
  for (const m of MILESTONES) {
    if (percent >= m.at && lastMilestone < m.at) {
      return { whisper: m.text, milestone: m.at };
    }
  }
  return { whisper: null as string | null, milestone: lastMilestone };
}

export const COMPASS_STEPS = [
  { id: "checking", label: "Prep" },
  { id: "preparing", label: "Forge" },
  { id: "downloading", label: "Atlas" },
  { id: "starting", label: "Go" },
] as const;

export function compassStepIndex(phase: LaunchPhase) {
  if (phase === "checking") return 0;
  if (phase === "preparing") return 1;
  if (phase === "downloading") return 2;
  if (phase === "starting" || phase === "running") return 3;
  return -1;
}

export function isLaunchInProgress(phase: LaunchPhase) {
  return phase === "checking" || phase === "preparing" || phase === "downloading" || phase === "starting";
}

/** Solo pintar widgets de lanzamiento en el Hub durante un lanzamiento real. */
export function isLaunchUiActive(phase: LaunchPhase, status?: string) {
  if (status === "launching") return true;
  return phase !== "idle" && phase !== "closed";
}

export function formatLaunchError(raw: string) {
  const msg = raw.replace(/^Error invoking remote method '[^']+':\s*/i, "").trim();
  if (/EPERM|EBUSY|operation not permitted/i.test(msg) && /jre-|awt\.dll|java/i.test(msg)) {
    return (
      "Windows bloqueó la instalación de Java (archivo en uso). " +
      "Cierra Minecraft, otros launchers y el Administrador de tareas (java.exe). " +
      "Luego reinicia CraftLauncher e inténtalo de nuevo."
    );
  }
  if (msg.length > 280) return `${msg.slice(0, 280)}…`;
  return msg;
}

export function filterStaleJavaLogs(
  structured: { message: string; detail?: string; level: string }[],
  phase?: LaunchPhase
) {
  let out = structured;
  const hasJavaReady = out.some((e) => e.level === "ok" && /java/i.test(e.message));
  if (hasJavaReady) {
    out = out.filter((e) => !/descargando java|extrayendo java/i.test(e.message));
  }
  if (phase === "running") {
    out = out.filter(
      (e) =>
        e.message !== "Error de lanzamiento" &&
        !/^error de lanzamiento$/i.test(e.message.trim())
    );
  }
  return out;
}

export function phaseShortLabel(phase: LaunchPhase) {
  const map: Record<LaunchPhase, string> = {
    idle: "",
    checking: "Comprobando",
    preparing: "Preparando Forge",
    downloading: "Sincronizando",
    starting: "Arrancando",
    running: "En juego",
    error: "Error",
    closed: "Cerrado",
  };
  return map[phase];
}
