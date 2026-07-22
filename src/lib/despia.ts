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
      (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1);
  const inAppWebView = !!w?.webkit?.messageHandlers || (isIOS && !/Safari\//.test(ua));
  if (isIOS && inAppWebView) return true;
  // Android inside a Capacitor / Despia wrapper: the Android WebView does not
  // expose Web Bluetooth, so we must route to the native @capacitor-community
  // /bluetooth-le plugin. Detect Android WebView (no Chrome token, or the
  // "; wv" marker) or an explicit Capacitor / Despia bridge on Android.
  const isAndroid = /Android/i.test(ua);
  if (isAndroid) {
    const isWebView = /; wv\)/.test(ua) || !/Chrome\/\d/.test(ua);
    if (isWebView || w?.Capacitor || w?.despia) return true;
  }
  return false;
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
  payload?: string; // hex bytes that were written (for debug)
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

const KNOWN_WATCH_SERVICES = [
  "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",
  "de5bf728-d711-4e47-af26-65e3012a5dc7",
  "0000fea1-0000-1000-8000-00805f9b34fb",
  "0000fea2-0000-1000-8000-00805f9b34fb",
  "0000180d-0000-1000-8000-00805f9b34fb",
  "0000180f-0000-1000-8000-00805f9b34fb",
  "0000180a-0000-1000-8000-00805f9b34fb",
];

async function ensureCapacitorBle(): Promise<boolean> {
  const w =
    typeof window !== "undefined"
      ? (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      : undefined;
  if (!w?.Capacitor) return false;
  // If Capacitor is only the web shim, @capacitor-community/bluetooth-le
  // delegates scans to navigator.bluetooth.requestLEScan, which iOS/WKWebView
  // does not support. Only use BleClient when the real native runtime is
  // present; otherwise fall back to Despia's native bluetooth:// bridge or the
  // browser Web Bluetooth path handled by useBluetooth.
  if (!w.Capacitor.isNativePlatform?.()) return false;
  try {
    if (!capacitorBleReady) {
      // androidNeverForLocation lets Android 12+ scan without the runtime
      // ACCESS_FINE_LOCATION prompt; without it many devices silently return
      // zero scan results even though BLUETOOTH_SCAN was granted.
      await BleClient.initialize({ androidNeverForLocation: true });
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

function mapCapacitorDevice(device: {
  deviceId: string;
  name?: string;
  uuids?: string[];
}): BleDevice {
  return {
    id: device.deviceId,
    name: device.name || "Unknown device",
    services: device.uuids,
  };
}

async function emitConnectedCapacitorDevices(services: string[] = []): Promise<BleDevice[]> {
  const serviceList = services.length ? services : KNOWN_WATCH_SERVICES;
  const seen = new Map<string, BleDevice>();
  for (const service of serviceList) {
    try {
      const devices = await BleClient.getConnectedDevices([service]);
      for (const device of devices) {
        const mapped = mapCapacitorDevice(device);
        const existing = seen.get(mapped.id);
        seen.set(mapped.id, {
          ...existing,
          ...mapped,
          services: Array.from(new Set([...(existing?.services || []), ...(mapped.services || []), service])),
        });
      }
    } catch (err) {
      console.warn("[capacitor-ble] getConnectedDevices failed", service, err);
    }
  }
  for (const device of seen.values()) emit("device", device);
  return [...seen.values()];
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
  w.onBleEvent = (e: { type: string; [k: string]: unknown }) => emit("event", e);
}

export const bluetooth = {
  /** Start scanning. `services` is an optional UUID allow-list. */
  scan: async (services: string[] = [], durationMs = 10000) => {
    if (await ensureCapacitorBle()) {
      await emitConnectedCapacitorDevices(services);
      // IMPORTANT: on iOS Core Bluetooth, passing `services: []` filters to
      // an empty allow-list and returns ZERO devices. Only include the
      // `services` key when the caller actually supplied UUIDs.
      // allowDuplicates:true is important on Android — many watches only
      // advertise their name in a scan-response packet, and with duplicates
      // filtered out the first (nameless) advert is all we ever see, so the
      // device never appears in the UI list.
      const scanOpts: Parameters<typeof BleClient.requestLEScan>[0] = {
        allowDuplicates: true,
      };
      if (services.length) {
        scanOpts.services = services;
        scanOpts.optionalServices = services;
      }
      console.log("[capacitor-ble] requestLEScan", scanOpts);
      try {
        await BleClient.requestLEScan(scanOpts, (result) =>
          emit("device", mapCapacitorScanResult(result)),
        );
        window.setTimeout(() => void bluetooth.stopScan(), durationMs);
      } catch (err) {
        const message = (err as Error)?.message || String(err);
        console.warn("[capacitor-ble] scan failed", err);
        emit("event", { type: "capacitor_scan_error", message });
        if (/permission|unauthori[sz]ed|denied/i.test(message)) {
          emit("state", { state: "unauthorized" });
        }
        throw err;
      }
      return;
    }
    const params = new URLSearchParams();
    if (services.length) params.set("services", services.join(","));
    params.set("duration", String(durationMs));
    console.log("[despia] bluetooth scan", { services, durationMs, isNative });
    return run(`bluetooth://scan?${params.toString()}`);
  },
  stopScan: async () => {
    if (await ensureCapacitorBle()) {
      await BleClient.stopLEScan().catch((err) =>
        console.warn("[capacitor-ble] stop scan failed", err),
      );
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
        const savedDevices = await BleClient.getDevices([id]).catch(() => []);
        for (const device of savedDevices) emit("device", mapCapacitorDevice(device));
        if (savedDevices.length === 0) await emitConnectedCapacitorDevices();
        await BleClient.connect(
          id,
          (deviceId) => emit("connect", { id: deviceId, state: "disconnected" }),
          { timeout: opts.timeout ?? 10000 },
        );
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
      await BleClient.disconnect(id).catch((err) =>
        console.warn("[capacitor-ble] disconnect failed", err),
      );
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
    return run(
      `bluetooth://read?id=${encodeURIComponent(id)}&service=${service}&char=${characteristic}`,
    );
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
      emit("writeComplete", { id, service, characteristic, success: true, payload: text });
      return;
    }
    try {
      await run(
        `bluetooth://write?id=${encodeURIComponent(id)}&service=${service}&char=${characteristic}&text=${encodeURIComponent(text)}&with_response=${withResponse}`,
      );
      emit("writeComplete", { id, service, characteristic, success: true, payload: text });
    } catch (err) {
      emit("writeComplete", {
        id,
        service,
        characteristic,
        success: false,
        error: (err as Error)?.message || String(err),
        payload: text,
      });
      throw err;
    }
  },
  subscribe: async (id: string, service: string, characteristic: string, server?: string) => {
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
      await BleClient.stopNotifications(id, service, characteristic).catch((err) =>
        console.warn("[capacitor-ble] unsubscribe failed", err),
      );
      return;
    }
    return run(
      `bluetooth://unsubscribe?id=${encodeURIComponent(id)}&service=${service}&char=${characteristic}`,
    );
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
