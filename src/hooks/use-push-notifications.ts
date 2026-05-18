import { useEffect } from "react";
import { isNative, push } from "@/lib/despia";
import { appStore, useAppState } from "@/lib/app-store";

/**
 * Registers for push notifications via Despia and stores the OneSignal
 * player ID in the app store. Safe to mount multiple times — it only runs
 * once per session until a player ID is captured.
 */
let inflight = false;

export async function registerPushNotifications(): Promise<string | null> {
  if (inflight) return appStore.get().pushPlayerId;
  if (appStore.get().pushPlayerId) return appStore.get().pushPlayerId;

  inflight = true;
  appStore.set({ pushStatus: "registering", pushError: null });

  try {
    if (!isNative) {
      // Browser dev — no-op, mark idle.
      appStore.set({ pushStatus: "idle" });
      return null;
    }

    await push.register();

    // Poll for the player ID (OneSignal needs a moment to provision).
    let playerId: string | null = null;
    for (let i = 0; i < 10 && !playerId; i++) {
      const res = await push.playerId();
      playerId = res?.onesignalPlayerId ?? null;
      if (!playerId) await new Promise((r) => setTimeout(r, 1000));
    }

    if (playerId) {
      appStore.set({ pushPlayerId: playerId, pushStatus: "registered" });
      return playerId;
    }

    appStore.set({ pushStatus: "error", pushError: "No player ID returned" });
    return null;
  } catch (err) {
    appStore.set({
      pushStatus: "error",
      pushError: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    inflight = false;
  }
}

/** Hook: kicks off registration on mount and exposes current push state. */
export function usePushNotifications() {
  const playerId = useAppState((s) => s.pushPlayerId);
  const status = useAppState((s) => s.pushStatus);
  const error = useAppState((s) => s.pushError);

  useEffect(() => {
    void registerPushNotifications();
  }, []);

  return { playerId, status, error, register: registerPushNotifications };
}
