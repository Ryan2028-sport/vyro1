import { useCallback, useEffect, useState } from "react";
import {
  bluetooth,
  isNative,
  type BleConnectEvent,
  type BleDataEvent,
  type BleDevice,
  type BleState,
} from "@/lib/despia";
import { QCBAND_SERVICE_UUID, QCBAND_SERVICE_V2_UUID } from "@/lib/vyro-ble/qcband";

export type BleConnectionState = "idle" | "connecting" | "connected" | "disconnected" | "failed";

export type BlePowerState = BleState["state"] | "unknown";

type BrowserBluetoothDevice = {
  id: string;
  name?: string;
  gatt?: {
    connected?: boolean;
    connect: () => Promise<{
      getPrimaryServices: () => Promise<
        Array<{
          uuid: string;
          getCharacteristics: () => Promise<
            Array<{
              uuid: string;
              properties: Record<string, boolean>;
            }>
          >;
        }>
      >;
    }>;
    disconnect: () => void;
  };
  addEventListener?: (type: string, listener: () => void) => void;
};

const browserDevices = new Map<string, BrowserBluetoothDevice>();

function getAndroidBluetoothMode(): { isAndroid: boolean; hasWebBluetooth: boolean; hasCapacitorBridge: boolean } {
  const isAndroid = /Android/i.test(navigator.userAgent || "");
  const nav = navigator as Navigator & {
    bluetooth?: { requestDevice?: (opts: unknown) => Promise<BrowserBluetoothDevice> };
  };
  const w = window as unknown as {
    Capacitor?: { getPlatform?: () => string; isNativePlatform?: () => boolean };
  };
  const platform = w.Capacitor?.getPlatform?.()?.toLowerCase();
  const hasCapacitorBridge = !!w.Capacitor && (w.Capacitor.isNativePlatform?.() === true || platform === "android");
  return {
    isAndroid,
    hasWebBluetooth: typeof nav.bluetooth?.requestDevice === "function",
    hasCapacitorBridge,
  };
}

function sameDeviceId(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const clean = (v: string) => v.toLowerCase().replace(/[^a-f0-9]/g, "");
  return clean(a) !== "" && clean(a) === clean(b);
}

export function useBluetooth() {
  const [devices, setDevices] = useState<Record<string, BleDevice>>({});
  const [scanning, setScanning] = useState(false);
  const [connectionState, setConnectionState] = useState<BleConnectionState>("idle");
  const [connectedId, setConnectedId] = useState<string | null>(null);
  const [lastData, setLastData] = useState<BleDataEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [powerState, setPowerState] = useState<BlePowerState>("unknown");

  useEffect(() => {
    const offDevice = bluetooth.on("device", (d: BleDevice) => {
      setDevices((prev) => ({ ...prev, [d.id]: { ...prev[d.id], ...d } }));
    });
    const offConnect = bluetooth.on("connect", (e: BleConnectEvent) => {
      setConnectionState(
        e.state === "connected"
          ? "connected"
          : e.state === "disconnected"
            ? "disconnected"
            : "failed",
      );
      setConnectedId(e.state === "connected" ? e.id : null);
      if (e.error) setError(e.error);
    });
    const offData = bluetooth.on("data", (d: BleDataEvent) => setLastData(d));
    const offState = bluetooth.on("state", (s) => {
      setPowerState(s.state);
      const isAndroid = /Android/i.test(navigator.userAgent || "");
      if (s.state === "unauthorized") {
        setError(
          isAndroid
            ? "Bluetooth permission denied. Enable Nearby devices/Bluetooth for VYRO in Android app settings. If the watch still does not appear, turn Location on too."
            : "Bluetooth permission denied. Enable it in iOS Settings.",
        );
      } else if (s.state === "off") {
        setError(isAndroid ? "Bluetooth is off. Turn it on, then tap Scan again." : "Bluetooth is off. Turn it on in Control Center.");
      } else if (s.state === "unsupported") {
        setError("Bluetooth is not supported on this device.");
      } else {
        setError(null);
      }
    });
    const offEvent = bluetooth.on("event", (event) => {
      const isAndroid = /Android/i.test(navigator.userAgent || "");
      if (!isAndroid) return;
      if (event.type === "android_location_services_off") {
        setError("Android Location Services are off. Turn Location on, then tap Scan again so BLE advertisements from the watch are not hidden.");
      }
      if (event.type === "capacitor_scan_error" && typeof event.message === "string") {
        const permissionLike = /permission|location|nearby|scan|denied|unauthori[sz]ed/i.test(event.message);
        setError(
          permissionLike
            ? "Android blocked BLE scanning. Enable Nearby devices/Bluetooth and Location for VYRO, then tap Scan again."
            : event.message,
        );
      }
    });
    const offScanEnd = bluetooth.on("scanEnd", () => setScanning(false));

    if (isNative) {
      void bluetooth.state();
    } else {
      const { isAndroid, hasWebBluetooth, hasCapacitorBridge } = getAndroidBluetoothMode();
      if (hasWebBluetooth) {
        setPowerState("on");
        setError(null);
      } else if (isAndroid && !hasCapacitorBridge) {
        setPowerState("unsupported");
        setError(
          "Android Bluetooth bridge was not detected. Open VYRO in Chrome for Web Bluetooth, or install/open the native Android app build.",
        );
      } else {
        setPowerState("unsupported");
      }
    }

    return () => {
      offDevice();
      offConnect();
      offData();
      offState();
      offEvent();
      offScanEnd();
    };
  }, []);

  const scan = useCallback(async (services: string[] = [], durationMs = 10000) => {
    setError(null);
    setDevices({});

    if (!isNative) {
      const nav = navigator as Navigator & {
        bluetooth?: {
          requestDevice: (opts: unknown) => Promise<BrowserBluetoothDevice>;
        };
      };
      if (!nav.bluetooth?.requestDevice) {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || "");
        const isAndroid = /Android/i.test(navigator.userAgent || "");
        setPowerState("unsupported");
        setError(
          isIOS
            ? "BLE bridge not detected. Reopen the app from the TestFlight build (Despia/Capacitor) — Safari/WKWebView have no Web Bluetooth on iOS."
            : isAndroid
              ? "BLE bridge not detected. Open this page from the Android app build (Capacitor) — the Android WebView does not expose Web Bluetooth. Chrome on Android works if you open the site directly."
              : "Web Bluetooth is not available in this browser. Open this page inside the native app build, or use Chrome/Edge on desktop.",
        );
        return;
      }
      setPowerState("on");
      setScanning(true);
      try {
        const d = await nav.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: services.length
            ? services
            : [
                "battery_service",
                "device_information",
                "heart_rate",
                QCBAND_SERVICE_UUID,
                QCBAND_SERVICE_V2_UUID,
                0xfee7,
                0xfee0,
                0xfff0,
                0xffe0,
              ],
        });
        browserDevices.set(d.id, d);
        setDevices((prev) => ({
          ...prev,
          [d.id]: { id: d.id, name: d.name || "Unknown device" },
        }));
      } catch (err) {
        const msg = (err as Error)?.message || String(err);
        if (/permission|denied|SecurityError/i.test(msg)) {
          setPowerState("unauthorized");
          setError("Android blocked Bluetooth access for this site/app. Allow Nearby devices/Bluetooth for VYRO, then tap Scan again.");
        } else if (!/cancell?ed|NotFoundError/i.test(msg)) {
          setError(msg);
        }
      } finally {
        setScanning(false);
      }
      return;
    }

    try {
      await bluetooth.state();
      setScanning(true);
      await bluetooth.scan(services, durationMs);
      window.setTimeout(() => setScanning(false), durationMs + 500);
    } catch (err) {
      setScanning(false);
      setError((err as Error)?.message || String(err));
    }
  }, []);

  const stopScan = useCallback(async () => {
    await bluetooth.stopScan();
    setScanning(false);
  }, []);

  const connect = useCallback(async (id: string) => {
    setConnectionState("connecting");
    setError(null);
    if (isNative && scanning) {
      await bluetooth.stopScan().catch(() => undefined);
      setScanning(false);
    }

    const browserDevice = browserDevices.get(id);
    if (browserDevice) {
      try {
        if (!browserDevice.gatt) {
          throw new Error("This Bluetooth device has no GATT server.");
        }
        browserDevice.addEventListener?.("gattserverdisconnected", () => {
          bluetooth.emitBrowserConnect({ id, state: "disconnected" });
        });
        const server = await browserDevice.gatt.connect();
        bluetooth.emitBrowserConnect({ id, state: "connected" });
        const services = await server.getPrimaryServices();
        bluetooth.emitBrowserDiscovered({
          id,
          services: await Promise.all(
            services.map(async (service) => ({
              uuid: service.uuid,
              characteristics: (await service.getCharacteristics()).map((c) => ({
                uuid: c.uuid,
                properties: Object.entries(c.properties)
                  .filter(([, enabled]) => enabled)
                  .map(([key]) => key),
              })),
            })),
          ),
        });
      } catch (err) {
        const msg = (err as Error)?.message || String(err);
        setConnectionState("failed");
        setError(msg);
        bluetooth.emitBrowserConnect({ id, state: "failed", error: msg });
      }
      return;
    }

    if (isNative && !Object.values(devices).some((d) => sameDeviceId(d.id, id))) {
      let resolvedId: string | null = null;
      const waitForDevice = new Promise<string>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          off();
          reject(new Error("Device not found nearby. Open the Band panel, tap Scan, then connect the watch that appears."));
        }, 10_000);
        const off = bluetooth.on("device", (d) => {
          if (sameDeviceId(d.id, id)) {
            window.clearTimeout(timeout);
            off();
            resolve(d.id);
          }
        });
      });
      try {
        await bluetooth.scan([], 9000);
        resolvedId = await waitForDevice;
      } catch (err) {
        const msg = (err as Error)?.message || String(err);
        setConnectionState("failed");
        setError(msg);
        bluetooth.emitBrowserConnect({ id, state: "failed", error: msg });
        return;
      }
      await bluetooth.connect(resolvedId, { autoConnect: true, timeout: 60000 });
      return;
    }

    await bluetooth.connect(id, { autoConnect: true, timeout: 60000 });
  }, [devices, scanning]);

  const disconnect = useCallback(async (id: string) => {
    const browserDevice = browserDevices.get(id);
    if (browserDevice?.gatt?.connected) {
      browserDevice.gatt.disconnect();
      bluetooth.emitBrowserConnect({ id, state: "disconnected" });
      return;
    }
    await bluetooth.disconnect(id);
  }, []);

  return {
    isNative,
    powerState,
    devices: Object.values(devices),
    scanning,
    connectionState,
    connectedId,
    lastData,
    error,
    scan,
    stopScan,
    connect,
    disconnect,
    read: bluetooth.read,
    write: bluetooth.write,
    subscribe: bluetooth.subscribe,
    unsubscribe: bluetooth.unsubscribe,
  };
}
