import { cn } from "@/lib/utils";
import { avatar } from "@/lib/styles";

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-10 w-10 text-sm",
};

export function Avatar({ name, size = "md", className }: AvatarProps) {
  return (
    <div className={cn(avatar, sizes[size], className)}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
