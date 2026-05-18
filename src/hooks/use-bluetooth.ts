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
      // Make sure we have an up-to-date power/permission read. The first call
      // also triggers the iOS permission prompt if it hasn't appeared yet.
      if (isNative) await bluetooth.state();
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
    await bluetooth.connect(id);
  }, []);

  const disconnect = useCallback(async (id: string) => {
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
