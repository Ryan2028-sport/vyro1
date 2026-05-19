import { useCallback, useEffect, useState } from "react";
import {
  bluetooth,
  isNative,
  type BleConnectEvent,
  type BleDataEvent,
  type BleDevice,
  type BleState,
} from "@/lib/despia";

export type BleConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed";

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

export function useBluetooth() {
  const [devices, setDevices] = useState<Record<string, BleDevice>>({});
  const [scanning, setScanning] = useState(false);
  const [connectionState, setConnectionState] =
    useState<BleConnectionState>("idle");
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
      if (s.state === "unauthorized")
        setError("Bluetooth permission denied. Enable it in iOS Settings.");
      else if (s.state === "off")
        setError("Bluetooth is off. Turn it on in Control Center.");
      else if (s.state === "unsupported")
        setError("Bluetooth is not supported on this device.");
      else setError(null);
    });
    const offScanEnd = bluetooth.on("scanEnd", () => setScanning(false));

    // Bootstrap: query current state. This also triggers the iOS permission
    // prompt on first BLE call and unblocks subsequent scans.
    if (isNative) void bluetooth.state();

    return () => {
      offDevice();
      offConnect();
      offData();
      offState();
      offScanEnd();
    };
  }, []);

  const scan = useCallback(
    async (services: string[] = [], durationMs = 10000) => {
      setError(null);
      setDevices({});

      // ---- Browser fallback (Web Bluetooth) ----
      // Native iOS WebKit has no navigator.bluetooth, but desktop Chrome/Edge
      // do. We use requestDevice() to show the OS chooser, then surface the
      // picked device in the list so the rest of the UI keeps working.
      if (!isNative) {
        const nav = navigator as Navigator & {
          bluetooth?: {
            requestDevice: (opts: unknown) => Promise<BrowserBluetoothDevice>;
          };
        };
        if (!nav.bluetooth?.requestDevice) {
          setError(
            "Web Bluetooth is not available in this browser. Open this page inside the TestFlight build, or use Chrome/Edge on desktop.",
          );
          return;
        }
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
          if (!/cancell?ed|NotFoundError/i.test(msg)) setError(msg);
        } finally {
          setScanning(false);
        }
        return;
      }

      // ---- Native (Despia BLE) ----
      // Make sure we have an up-to-date power/permission read. The first call
      // also triggers the iOS permission prompt if it hasn't appeared yet.
      await bluetooth.state();
      setScanning(true);
      await bluetooth.scan(services, durationMs);
      // Fallback if onBleScanEnd never arrives.
      window.setTimeout(() => setScanning(false), durationMs + 500);
    },
    [],
  );

  const stopScan = useCallback(async () => {
    await bluetooth.stopScan();
    setScanning(false);
  }, []);

  const connect = useCallback(async (id: string) => {
    setConnectionState("connecting");
    setError(null);

    const browserDevice = browserDevices.get(id);
    if (browserDevice) {
      try {
        if (!browserDevice.gatt) throw new Error("This Bluetooth device has no GATT server.");
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

    await bluetooth.connect(id);
  }, []);

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
