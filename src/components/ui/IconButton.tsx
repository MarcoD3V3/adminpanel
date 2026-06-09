import { cn } from "@/lib/utils";
import { iconBtn } from "@/lib/styles";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export function IconButton({ label, children, className, ...props }: IconButtonProps) {
  return (
    <button type="button" aria-label={label} title={label} className={cn(iconBtn, className)} {...props}>
      {children}
    </button>
  );
}
