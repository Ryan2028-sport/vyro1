import { useCallback, useEffect, useState } from "react";
import {
  bluetooth,
  isNative,
  type BleConnectEvent,
  type BleDataEvent,
  type BleDevice,
} from "@/lib/despia";

export type BleConnectionState = "idle" | "connecting" | "connected" | "disconnected" | "failed";

export function useBluetooth() {
  const [devices, setDevices] = useState<Record<string, BleDevice>>({});
  const [scanning, setScanning] = useState(false);
  const [connectionState, setConnectionState] = useState<BleConnectionState>("idle");
  const [connectedId, setConnectedId] = useState<string | null>(null);
  const [lastData, setLastData] = useState<BleDataEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    return () => {
      offDevice();
      offConnect();
      offData();
    };
  }, []);

  const scan = useCallback(
    async (services: string[] = [], durationMs = 10000) => {
      setError(null);
      setDevices({});
      setScanning(true);
      await bluetooth.scan(services, durationMs);
      window.setTimeout(() => setScanning(false), durationMs);
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
