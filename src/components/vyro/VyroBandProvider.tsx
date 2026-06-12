// App-wide VYRO band context. Wraps `useVyroBand` once so events, counts and
// the live BLE connection persist across view changes. Also implements
// auto-reconnect: while a paired band id exists in the user profile and the
// band is offline, we re-attempt the GATT connection on a backoff so the data
// feed comes back on its own as soon as the band is in range.
//
// IMPORTANT — "always on when the app is closed":
//   - On the native iOS bridge (Despia) the BLE central can stay subscribed
//     in the background within the limits Apple grants; this provider keeps
//     the subscription alive and auto-reconnects if iOS drops the link.
//   - In the browser (Web Bluetooth) the OS tears down GATT when the tab is
//     closed. We auto-reconnect the moment the tab is reopened.
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/profile.functions";
import { useVyroBand } from "@/hooks/use-vyro-band";
import { isNative, location as despiaLocation } from "@/lib/despia";

type VyroBandCtx = ReturnType<typeof useVyroBand> & {
  pairedId: string | null;
  pairedName: string | null;
};

const Ctx = createContext<VyroBandCtx | null>(null);

export function useVyroBandCtx() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useVyroBandCtx must be used inside <VyroBandProvider />");
  return v;
}

export function VyroBandProvider({ children }: { children: ReactNode }) {
  const fetchProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const pairedId = profile?.paired_band_id ?? null;
  const pairedName = profile?.paired_band_name ?? null;

  const vyro = useVyroBand();
  const { ble } = vyro;

  // Auto-reconnect loop. Tries to (re)connect to the paired band whenever it
  // is not currently live. Uses a 6s tick; the underlying connect call is
  // idempotent / short-circuited once connected.
  const tryingRef = useRef(false);
  useEffect(() => {
    if (!pairedId) return;
    let stopped = false;
    async function attempt() {
      if (stopped || tryingRef.current) return;
      if (ble.connectedId === pairedId) return;
      if (ble.connectionState === "connecting") return;
      tryingRef.current = true;
      try {
        await ble.connect(pairedId!);
      } catch {
        /* swallow, the tick will retry */
      } finally {
        tryingRef.current = false;
      }
    }
    void attempt();
    const id = window.setInterval(attempt, 6000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [pairedId, ble.connectedId, ble.connectionState, ble.connect]);

  // When the page becomes visible again after a tab/app suspend, kick a
  // reconnect immediately instead of waiting for the next tick. We DO NOT
  // disconnect on hide — the whole point of "always on" is that the BLE
  // link survives the app being backgrounded.
  useEffect(() => {
    function onVis() {
      if (document.visibilityState === "visible" && pairedId && ble.connectedId !== pairedId) {
        void ble.connect(pairedId);
      }
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [pairedId, ble.connectedId, ble.connect]);

  // Native: enable background location so iOS keeps the app alive long
  // enough for Core Bluetooth to deliver notifications while backgrounded.
  // Browser: request a Screen Wake Lock so the tab isn't aggressively
  // suspended while the user is on another tab with the screen on.
  useEffect(() => {
    if (!pairedId) return;
    if (isNative) {
      void despiaLocation.backgroundOn();
      return () => {
        void despiaLocation.backgroundOff();
      };
    }
    let wakeLock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    async function acquire() {
      try {
        if (nav.wakeLock?.request) {
          wakeLock = await nav.wakeLock.request("screen");
        }
      } catch {
        /* user gesture or permission missing — ignore */
      }
    }
    void acquire();
    const onVis = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void wakeLock?.release().catch(() => undefined);
    };
  }, [pairedId]);

  return (
    <Ctx.Provider value={{ ...vyro, pairedId, pairedName }}>{children}</Ctx.Provider>
  );
}
