"use client";

/** Fondo del menú principal (sin decoración fija — todo va como elementos del editor). */
export function GameMenuDecor({ width, height }: { width: number; height: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[2] select-none bg-black"
      style={{ width, height }}
      aria-hidden
    />
  );
}
