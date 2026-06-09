import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "ahora";
  if (diffMins < 60) return `hace ${diffMins}m`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  return `hace ${diffDays}d`;
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatExpiresIn(date: string): string {
  const diffMs = new Date(date).getTime() - Date.now();
  if (diffMs <= 0) return "expirado";
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 60) return `expira en ${Math.max(1, diffMins)}m`;
  if (diffHours < 24) return `expira en ${diffHours}h`;
  return `expira en ${diffDays}d`;
}

export function isExpired(iso: string): boolean {
  return Date.parse(iso) < Date.now();
}

export function expiresWithin(iso: string, ms: number): boolean {
  const remaining = Date.parse(iso) - Date.now();
  return remaining > 0 && remaining <= ms;
}
