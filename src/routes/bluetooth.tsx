import { createFileRoute } from "@tanstack/react-router";
import { Bluetooth, Loader2, Radio, Wifi, X } from "lucide-react";
import { useMemo } from "react";
import { useBluetooth } from "@/hooks/use-bluetooth";
import { isNative } from "@/lib/despia";

export const Route = createFileRoute("/bluetooth")({
  component: BluetoothPage,
  head: () => ({
    meta: [
      { title: "Bluetooth · VYRO" },
      {
        name: "description",
        content: "Scan and connect to nearby Bluetooth devices.",
      },
    ],
  }),
});

function rssiBars(rssi?: number) {
  if (rssi == null) return 0;
  if (rssi >= -55) return 4;
  if (rssi >= -67) return 3;
  if (rssi >= -80) return 2;
  return 1;
}

function rssiLabel(rssi?: number) {
  if (rssi == null) return "—";
  if (rssi >= -55) return "Excellent";
  if (rssi >= -67) return "Good";
  if (rssi >= -80) return "Fair";
  return "Weak";
}

function BluetoothPage() {
  const {
    devices,
    scanning,
    connectionState,
    connectedId,
    error,
    scan,
    stopScan,
    connect,
    disconnect,
  } = useBluetooth();

  const sorted = useMemo(
    () => [...devices].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999)),
    [devices],
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),transparent_28%),linear-gradient(180deg,#080808,#000)] text-white">
      <div className="mx-auto max-w-2xl px-5 py-8">
        <header className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/15 bg-white/[0.06]">
            <Bluetooth className="h-5 w-5" />
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
              VYRO · Connectivity
            </div>
            <h1 className="text-2xl font-black">Bluetooth</h1>
          </div>
        </header>

        {!isNative && (
          <div className="mb-5 rounded-2xl border border-yellow-500/30 bg-yellow-500/[0.06] p-4 text-sm text-yellow-100/90">
            BLE only runs inside the native Despia app. In the browser, scan
            does nothing.
          </div>
        )}

        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => (scanning ? stopScan() : scan([], 10000))}
            className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/[0.08] px-5 py-3 text-sm font-semibold hover:bg-white/[0.14]"
          >
            {scanning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Stop scan
              </>
            ) : (
              <>
                <Radio className="h-4 w-4" />
                Start scan
              </>
            )}
          </button>
          <div className="font-mono text-xs text-white/45">
            {scanning ? "Scanning…" : `${sorted.length} found`}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}

        <div className="space-y-2">
          {sorted.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center text-sm text-white/45">
              {scanning
                ? "Looking for nearby devices…"
                : "No devices yet. Tap Start scan."}
            </div>
          )}

          {sorted.map((d) => {
            const bars = rssiBars(d.rssi);
            const isConnected = connectedId === d.id;
            const isConnecting =
              connectionState === "connecting" && !connectedId;
            return (
              <div
                key={d.id}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.05]">
                  <Wifi className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {d.name || "Unknown device"}
                  </div>
                  <div className="truncate font-mono text-[10px] text-white/40">
                    {d.id}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-end justify-end gap-[2px] h-4">
                    {[1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className={`w-[3px] rounded-sm ${
                          i <= bars ? "bg-emerald-400" : "bg-white/15"
                        }`}
                        style={{ height: `${i * 3 + 3}px` }}
                      />
                    ))}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-white/45">
                    {d.rssi ?? "—"} dBm · {rssiLabel(d.rssi)}
                  </div>
                </div>
                <button
                  onClick={() =>
                    isConnected ? disconnect(d.id) : connect(d.id)
                  }
                  disabled={isConnecting}
                  className={`ml-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                    isConnected
                      ? "border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                      : "border-white/20 bg-white/[0.08] hover:bg-white/[0.16]"
                  }`}
                >
                  {isConnected ? (
                    <span className="flex items-center gap-1">
                      <X className="h-3 w-3" />
                      Disconnect
                    </span>
                  ) : isConnecting ? (
                    "…"
                  ) : (
                    "Connect"
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
