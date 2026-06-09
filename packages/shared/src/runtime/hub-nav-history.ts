const MAX_SCREEN_NAV_HISTORY = 48;

const screenNavStack: string[] = [];

/** Registra la pantalla actual antes de cambiar a otra. */
export function pushScreenNavHistory(screenId: string) {
  const id = screenId.trim();
  if (!id) return;
  if (screenNavStack[screenNavStack.length - 1] === id) return;
  screenNavStack.push(id);
  if (screenNavStack.length > MAX_SCREEN_NAV_HISTORY) {
    screenNavStack.shift();
  }
}

/** Devuelve la pantalla anterior y la quita del historial. */
export function popScreenNavHistory(): string | null {
  return screenNavStack.pop() ?? null;
}

export function clearScreenNavHistory() {
  screenNavStack.length = 0;
}

export function screenNavHistoryDepth(): number {
  return screenNavStack.length;
}
