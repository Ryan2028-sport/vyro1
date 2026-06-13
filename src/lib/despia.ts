// Despia native bridge wrapper for Vyro.
// Exposes a typed helper around the `despia-native` SDK plus a `isNative` flag
// so calls become safe no-ops in regular browsers.

import despia from "despia-native";
import {
  BleClient,
  dataViewToHexString,
  hexStringToDataView,
  type ScanResult,
} from "@capacitor-community/bluetooth-le";

// Detect the native iOS wrapper. Despia injects "despia" into the UA, but
// the Capacitor TestFlight build does NOT — it sets window.Capacitor and the
// UA reports plain Mobile Safari. Without this, the BLE layer falls back to
// Web Bluetooth (which iOS WKWebView does not implement) and throws
// "Web Bluetooth is not available". We treat ANY iOS app-context webview as
// native: Despia UA, Capacitor bridge, or the standalone PWA install.
function detectNative(): boolean {
  if (typeof navigator === "undefined") return false;
  const w =
    typeof window !== "undefined"
      ? (window as unknown as {
          Capacitor?: unknown;
          webkit?: { messageHandlers?: unknown };
          despia?: unknown;
        })
      : undefined;
  const ua = navigator.userAgent || "";
  if (/despia/i.test(ua)) return true;
  if (w?.Capacitor) return true;
  if (w?.despia) return true;
  // WKWebView on iOS (TestFlight wrappers) exposes webkit.messageHandlers
  // and reports as iPhone/iPad with no Safari token in the UA.
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Mac") &&
      (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! >
        1);
  const inAppWebView = !!w?.webkit?.messageHandlers || (isIOS && !/Safari\//.test(ua));
  return isIOS && inAppWebView;
}

export const isNative = detectNative();

/** Fire-and-forget a despia:// command. No-op outside the native runtime. */
export async function run(command: string): Promise<void> {
  if (!isNative) return;
  try {
    await despia(command);
  } catch (err) {
    console.warn("[despia] command failed:", command, err);
  }
}

/** Run a command and wait for the given response variables. */
export async function runWatch<T = Record<string, unknown>>(
  command: string,
  watch: string[],
): Promise<T | null> {
  if (!isNative) return null;
  try {
    return (await despia<T>(command, watch)) as T;
  } catch (err) {
    console.warn("[despia] watch command failed:", command, err);
    return null;
  }
}

// --- Convenience APIs (only the high-value surface; extend as needed) ---

export const haptics = {
  light: () => run("lighthaptic://"),
  heavy: () => run("heavyhaptic://"),
  success: () => run("successhaptic://"),
  warning: () => run("warninghaptic://"),
  error: () => run("errorhaptic://"),
};

export const biometrics = {
  /** Prompt Face ID / Touch ID. Resolves true if the user authenticated. */
  async prompt(reason = "Authenticate"): Promise<boolean> {
    if (!isNative) return true; // allow in browser dev
    const res = await runWatch<{ bioAuthSuccess?: string }>(
      `bioauth://?reason=${encodeURIComponent(reason)}`,
      ["bioAuthSuccess"],
    );
    return res?.bioAuthSuccess === "true";
  },
};

export const share = (message: string, url: string) =>
  run(`shareapp://message?=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`);

export const saveImage = (url: string) => run(`savethisimage://?url=${encodeURIComponent(url)}`);

export const statusBar = {
  color: (hex: string) => run(`statusbarcolor://{${hex}}`),
  textColor: (mode: "light" | "dark") => run(`statusbartextcolor://{${mode}}`),
  hide: () => run("hidebars://on"),
  show: () => run("hidebars://off"),
};

export const appInfo = () =>
  runWatch<{ versionNumber: string; bundleNumber: string }>("getappversion://", [
    "versionNumber",
    "bundleNumber",
  ]);

export const deviceUuid = () => runWatch<{ uuid: string }>("get-uuid://", ["uuid"]);

export const push = {
  register: () => run("registerpush://"),
  playerId: () =>
    runWatch<{ onesignalPlayerId: string }>("getonesignalplayerid://", ["onesignalPlayerId"]),
  localMessage: (msg: string) => run(`sendlocalpushmsg://${encodeURIComponent(msg)}`),
};

export const location = {
  backgroundOn: () => run("backgroundlocationon://"),
  backgroundOff: () => run("backgroundlocationoff://"),
};

export const purchases = {
  buy: (productId: string, externalId: string) =>
    runWatch<{ purchaseResult: string; transactionID: string }>(
      `revenuecat://purchase?external_id=${encodeURIComponent(externalId)}&product=${encodeURIComponent(productId)}`,
      ["purchaseResult", "transactionID"],
    ),
};

// --- Bluetooth (BLE central) ---
// Despia delivers BLE events through global window callbacks.
// We mirror them into a simple emitter so React code can subscribe.

export type BleDevice = {
  id: string;
  name?: string;
  rssi?: number;
  services?: string[];
};

export type BleConnectEvent = {
  id: string;
  state: "connected" | "disconnected" | "failed";
  error?: string;
};

export type BleDataEvent = {
  id: string;
  service: string;
  characteristic: string;
  value: string; // hex or base64 depending on platform
};

export type BleState = {
  state: "on" | "off" | "unauthorized" | "unsupported";
};

export type BleDiscovered = {
  id: string;
  services: Array<{
    uuid: string;
    characteristics: Array<{ uuid: string; properties: string[] }>;
  }>;
};

export type BleWriteComplete = {
  id: string;
  service: string;
  characteristic: string;
  success: boolean;
  error?: string;
};

type BleEventMap = {
  device: BleDevice;
  connect: BleConnectEvent;
  data: BleDataEvent;
  state: BleState;
  scanEnd: { count?: number };
  discovered: BleDiscovered;
  writeComplete: BleWriteComplete;
  event: { type: string; [k: string]: unknown };
};

type Listener<T> = (payload: T) => void;
const bleListeners: { [K in keyof BleEventMap]: Listener<BleEventMap[K]>[] } = {
  device: [],
  connect: [],
  data: [],
  state: [],
  scanEnd: [],
  discovered: [],
  writeComplete: [],
  event: [],
};

function emit<K extends keyof BleEventMap>(key: K, payload: BleEventMap[K]) {
  for (const fn of bleListeners[key]) {
    try {
      fn(payload);
    } catch (err) {
      console.warn("[despia] ble listener error", err);
    }
  }
}

let capacitorBleReady = false;

async function ensureCapacitorBle(): Promise<boolean> {
  const w = typeof window !== "undefined" ? (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }) : undefined;
  if (!w?.Capacitor) return false;
  try {
    if (!capacitorBleReady) {
      await BleClient.initialize();
      capacitorBleReady = true;
    }
    const enabled = await BleClient.isEnabled();
    emit("state", { state: enabled ? "on" : "off" });
    return true;
  } catch (err) {
    const message = (err as Error)?.message || String(err);
    const denied = /permission|unauthori[sz]ed|denied/i.test(message);
    emit("state", { state: denied ? "unauthorized" : "unsupported" });
    emit("event", { type: "capacitor_ble_error", message });
    console.warn("[capacitor-ble] init/state failed", err);
    return true;
  }
}

function mapCapacitorScanResult(result: ScanResult): BleDevice {
  return {
    id: result.device.deviceId,
    name: result.localName || result.device.name || "Unknown device",
    rssi: result.rssi,
    services: result.uuids || result.device.uuids,
  };
}

// Wire up the global callbacks Despia fires from native.
// These MUST be defined before any despia() BLE command runs — the native
// side does not buffer foreground events, so late handlers miss events.
if (typeof window !== "undefined") {
  const w = window as unknown as Record<string, unknown>;
  w.onBleDevice = (d: BleDevice) => emit("device", d);
  w.onBleConnect = (e: BleConnectEvent) => emit("connect", e);
  w.onBleData = (e: BleDataEvent) => emit("data", e);
  w.onBleState = (s: BleState) => emit("state", s);
  w.onBleScanEnd = (e: { count?: number } = {}) => emit("scanEnd", e);
  w.onBleDiscovered = (t: BleDiscovered) => emit("discovered", t);
  w.onBleWriteComplete = (e: BleWriteComplete) => emit("writeComplete", e);
  w.onBleEvent = (e: { type: string; [k: string]: unknown }) =>
    emit("event", e);
}

export const bluetooth = {
  /** Start scanning. `services` is an optional UUID allow-list. */
  scan: async (services: string[] = [], durationMs = 10000) => {
    if (await ensureCapacitorBle()) {
      await BleClient.requestLEScan(
        {
          ...(services.length ? { services } : {}),
          optionalServices: services,
          allowDuplicates: false,
        },
        (result) => emit("device", mapCapacitorScanResult(result)),
      );
      window.setTimeout(() => void bluetooth.stopScan(), durationMs);
      return;
    }
    const params = new URLSearchParams();
    // Only attach `services` when the caller actually passed UUIDs. Some
    // native BLE bridges interpret an empty `services=` param as "filter to
    // []" and return zero devices, instead of "no filter".
    if (services.length) params.set("services", services.join(","));
    params.set("duration", String(durationMs));
    console.log("[despia] bluetooth scan", { services, durationMs, isNative });
    return run(`bluetooth://scan?${params.toString()}`);
  },
  stopScan: async () => {
    if (await ensureCapacitorBle()) {
      await BleClient.stopLEScan().catch((err) => console.warn("[capacitor-ble] stop scan failed", err));
      emit("scanEnd", {});
      return;
    }
    return run("bluetooth://stopscan");
  },
  state: async () => {
    if (await ensureCapacitorBle()) return;
    return run("bluetooth://state");
  },
  connect: async (
    id: string,
    opts: { timeout?: number; autoConnect?: boolean; server?: string } = {},
  ) => {
    if (await ensureCapacitorBle()) {
      try {
        await BleClient.connect(id, (deviceId) => emit("connect", { id: deviceId, state: "disconnected" }), {
          timeout: opts.timeout ?? 10000,
        });
        emit("connect", { id, state: "connected" });
        const services = await BleClient.getServices(id);
        emit("discovered", {
          id,
          services: services.map((service) => ({
            uuid: service.uuid,
            characteristics: service.characteristics.map((c) => ({
              uuid: c.uuid,
              properties: Object.entries(c.properties)
                .filter(([, enabled]) => enabled)
                .map(([key]) => key),
            })),
          })),
        });
      } catch (err) {
        const message = (err as Error)?.message || String(err);
        emit("connect", { id, state: "failed", error: message });
      }
      return;
    }
    const params = new URLSearchParams({
      id,
      timeout: String(opts.timeout ?? 10000),
    });
    if (opts.autoConnect) params.set("auto_connect", "true");
    if (opts.server) params.set("server", opts.server);
    return run(`bluetooth://connect?${params.toString()}`);
  },
  disconnect: async (id: string) => {
    if (await ensureCapacitorBle()) {
      await BleClient.disconnect(id).catch((err) => console.warn("[capacitor-ble] disconnect failed", err));
      emit("connect", { id, state: "disconnected" });
      return;
    }
    return run(`bluetooth://disconnect?id=${encodeURIComponent(id)}`);
  },
  discover: async (id: string) => {
    if (await ensureCapacitorBle()) {
      await BleClient.discoverServices(id);
      const services = await BleClient.getServices(id);
      emit("discovered", {
        id,
        services: services.map((service) => ({
          uuid: service.uuid,
          characteristics: service.characteristics.map((c) => ({
            uuid: c.uuid,
            properties: Object.entries(c.properties)
              .filter(([, enabled]) => enabled)
              .map(([key]) => key),
          })),
        })),
      });
      return;
    }
    return run(`bluetooth://discover?id=${encodeURIComponent(id)}`);
  },
  read: async (id: string, service: string, characteristic: string) => {
    if (await ensureCapacitorBle()) {
      const value = await BleClient.read(id, service, characteristic);
      emit("data", { id, service, characteristic, value: dataViewToHexString(value) });
      return;
    }
    return run(`bluetooth://read?id=${encodeURIComponent(id)}&service=${service}&char=${characteristic}`);
  },
  write: async (
    id: string,
    service: string,
    characteristic: string,
    text: string,
    withResponse = true,
  ) => {
    if (await ensureCapacitorBle()) {
      const value = hexStringToDataView(text);
      if (withResponse) await BleClient.write(id, service, characteristic, value);
      else await BleClient.writeWithoutResponse(id, service, characteristic, value);
      emit("writeComplete", { id, service, characteristic, success: true });
      return;
    }
    return run(`bluetooth://write?id=${encodeURIComponent(id)}&service=${service}&char=${characteristic}&text=${encodeURIComponent(text)}&with_response=${withResponse}`);
  },
  subscribe: async (
    id: string,
    service: string,
    characteristic: string,
    server?: string,
  ) => {
    if (await ensureCapacitorBle()) {
      await BleClient.startNotifications(id, service, characteristic, (value) => {
        emit("data", { id, service, characteristic, value: dataViewToHexString(value) });
      });
      return;
    }
    let url = `bluetooth://subscribe?id=${encodeURIComponent(id)}&service=${service}&char=${characteristic}`;
    if (server) url += `&server=${encodeURIComponent(server)}`;
    return run(url);
  },
  unsubscribe: async (id: string, service: string, characteristic: string) => {
    if (await ensureCapacitorBle()) {
      await BleClient.stopNotifications(id, service, characteristic).catch((err) => console.warn("[capacitor-ble] unsubscribe failed", err));
      return;
    }
    return run(`bluetooth://unsubscribe?id=${encodeURIComponent(id)}&service=${service}&char=${characteristic}`);
  },
  rssi: async (id: string) => {
    if (await ensureCapacitorBle()) {
      const value = await BleClient.readRssi(id);
      emit("event", { type: "rssi", id, value });
      return;
    }
    return run(`bluetooth://rssi?id=${encodeURIComponent(id)}`);
  },
  emitBrowserConnect: (event: BleConnectEvent) => emit("connect", event),
  emitBrowserDiscovered: (tree: BleDiscovered) => emit("discovered", tree),
  /** Subscribe to BLE events. Returns an unsubscribe fn. */
  on<K extends keyof BleEventMap>(event: K, listener: Listener<BleEventMap[K]>) {
    bleListeners[event].push(listener);
    return () => {
      const arr = bleListeners[event];
      const idx = arr.indexOf(listener);
      if (idx >= 0) arr.splice(idx, 1);
    };
  },
};

export { despia };
export default despia;
