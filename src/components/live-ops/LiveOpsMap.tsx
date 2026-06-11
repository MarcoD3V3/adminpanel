import { cn } from "@/lib/utils";
import { latLngToMapPercent } from "@/lib/live-ops/geo";
import type { LiveOpsSession } from "@/types";

interface LiveOpsMapProps {
  sessions: LiveOpsSession[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const statusDot: Record<string, string> = {
  playing: "bg-[var(--color-accent)]",
  online: "bg-[var(--color-text-soft)]",
  idle: "bg-[var(--color-muted)]",
  launching: "bg-[var(--color-warning-text)]",
  updating: "bg-[var(--color-danger-text)]",
};

const testerDot = "bg-violet-400";

const healthRing: Record<string, string> = {
  healthy: "ring-[var(--color-accent-muted)]",
  warning: "ring-[var(--color-warning-text)]",
  critical: "ring-[var(--color-danger-text)]",
};

export function LiveOpsMap({ sessions, selectedId, onSelect }: LiveOpsMapProps) {
  return (
    <div className="relative aspect-[2/1] w-full overflow-hidden rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)]">
      <svg viewBox="0 0 800 400" className="h-full w-full opacity-30" aria-hidden>
        <ellipse cx="400" cy="400" rx="390" ry="200" fill="none" stroke="var(--color-border)" strokeWidth="0.5" />
        {[100, 200, 300, 400, 500, 600, 700].map((x) => (
          <line key={`v${x}`} x1={x} y1="0" x2={x} y2="400" stroke="var(--color-border-subtle)" strokeWidth="0.5" />
        ))}
        {[100, 200, 300].map((y) => (
          <line key={`h${y}`} x1="0" y1={y} x2="800" y2={y} stroke="var(--color-border-subtle)" strokeWidth="0.5" />
        ))}
        <path
          d="M120,120 Q200,80 280,100 T440,90 T560,110 T680,95 L680,130 Q600,150 520,140 T360,155 T240,145 T120,130Z"
          fill="var(--color-surface-hover)"
          opacity="0.5"
        />
        <path
          d="M150,200 Q250,170 350,190 T550,180 T700,195 L680,240 Q550,260 400,250 T200,245 T130,220Z"
          fill="var(--color-surface-hover)"
          opacity="0.4"
        />
        <path
          d="M300,260 Q400,240 500,255 T650,248 L640,290 Q520,310 400,300 T280,295 T290,270Z"
          fill="var(--color-surface-hover)"
          opacity="0.35"
        />
      </svg>

      {sessions.map((session) => {
        const { x, y } = latLngToMapPercent(session.lat, session.lng);
        const active = selectedId === session.id;
        return (
          <button
            key={session.id}
            type="button"
            title={`${session.username}${session.tester ? " (tester)" : ""} · ${session.city}, ${session.country}`}
            onClick={() => onSelect(session.id)}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <span
              className={cn(
                "block h-3 w-3 rounded-full ring-2 ring-offset-1 ring-offset-[var(--color-surface)] transition-transform",
                session.tester ? testerDot : statusDot[session.status],
                session.tester ? "ring-violet-400/60" : healthRing[session.health],
                active && "scale-150"
              )}
            />
          </button>
        );
      })}

      <div className="absolute bottom-3 left-3 flex flex-wrap gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]/90 px-3 py-2 text-[10px] text-[var(--color-text-soft)]">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" /> Jugando</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--color-text-soft)]" /> Online</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-400" /> Tester</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full ring-2 ring-[var(--color-danger-text)]" /> Alerta</span>
      </div>
    </div>
  );
}
