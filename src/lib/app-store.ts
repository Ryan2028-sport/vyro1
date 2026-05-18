// Lightweight global app state for native/device info.
// No external state library — uses a tiny subscribe store + React hook.

import { useSyncExternalStore } from "react";

export type AppState = {
  pushPlayerId: string | null;
  pushStatus: "idle" | "registering" | "registered" | "error";
  pushError: string | null;
};

const STORAGE_KEY = "vyro.appState";

function load(): AppState {
  if (typeof localStorage === "undefined") {
    return { pushPlayerId: null, pushStatus: "idle", pushError: null };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { pushStatus: "idle", pushError: null, ...JSON.parse(raw) };
  } catch {}
  return { pushPlayerId: null, pushStatus: "idle", pushError: null };
}

let state: AppState = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ pushPlayerId: state.pushPlayerId }),
    );
  } catch {}
}

export const appStore = {
  get: () => state,
  set(patch: Partial<AppState>) {
    state = { ...state, ...patch };
    persist();
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useAppState<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    appStore.subscribe,
    () => selector(state),
    () => selector(state),
  );
}
