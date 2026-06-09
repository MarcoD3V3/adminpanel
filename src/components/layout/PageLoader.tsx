export function PageLoader({ label = "página" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]"
        aria-hidden
      />
      <p className="text-sm text-[var(--color-muted)]">Cargando {label}…</p>
    </div>
  );
}
