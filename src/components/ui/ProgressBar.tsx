import { cn } from "@/lib/utils";
import { progressFill, progressTrack } from "@/lib/styles";

interface ProgressBarProps {
  value: number;
  className?: string;
}

export function ProgressBar({ value, className }: ProgressBarProps) {
  return (
    <div className={cn(progressTrack, className)}>
      <div className={progressFill} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
