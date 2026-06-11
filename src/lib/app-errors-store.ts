import { create } from "zustand";

export type AppErrorItem = {
  id: string;
  message: string;
  at: number;
};

const MAX_ERRORS = 20;

type AppErrorsState = {
  errors: AppErrorItem[];
  expanded: boolean;
  pushError: (message: string) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
  toggleExpanded: () => void;
  setExpanded: (expanded: boolean) => void;
};

export const useAppErrorsStore = create<AppErrorsState>((set, get) => ({
  errors: [],
  expanded: false,
  pushError: (message) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    const item: AppErrorItem = {
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      message: trimmed,
      at: Date.now(),
    };
    set((state) => ({
      errors: [item, ...state.errors].slice(0, MAX_ERRORS),
    }));
  },
  removeError: (id) => {
    const next = get().errors.filter((e) => e.id !== id);
    set({ errors: next, expanded: next.length > 0 && get().expanded });
  },
  clearErrors: () => set({ errors: [], expanded: false }),
  toggleExpanded: () => {
    const { errors, expanded } = get();
    if (errors.length === 0) return;
    set({ expanded: !expanded });
  },
  setExpanded: (expanded) => set({ expanded }),
}));

export function reportAppError(message: string | null | undefined): void {
  if (message) useAppErrorsStore.getState().pushError(message);
}

export function clearAppErrors(): void {
  useAppErrorsStore.getState().clearErrors();
}
