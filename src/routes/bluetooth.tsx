import { createFileRoute } from "@tanstack/react-router";
import { Bluetooth, Loader2, Radio, Wifi, X, ClipboardCopy, ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useBluetooth } from "@/hooks/use-bluetooth";
import {
  bluetooth,
  isNative,
  type BleDiscovered,
  type BleDataEvent,
} from "@/lib/despia";

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

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i++)
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}
function b64ToBytes(b64: string): Uint8Array {
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array();
  }
}
function toBytes(value: string): Uint8Array {
  if (!value) return new Uint8Array();
  if (/^[0-9a-fA-F\s:]+$/.test(value) && value.replace(/[^0-9a-f]/gi, "").length % 2 === 0)
    return hexToBytes(value);
  return b64ToBytes(value);
}
function decodeAll(bytes: Uint8Array) {
  if (!bytes.length) return { hex: "", ascii: "", len: 0 } as Record<string, unknown>;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
  let ascii = "";
  for (const b of bytes) ascii += b >= 32 && b < 127 ? String.fromCharCode(b) : ".";
  const out: Record<string, unknown> = { len: bytes.length, hex, ascii };
  if (bytes.length >= 1) out.uint8 = bytes[0];
  if (bytes.length >= 2) {
    out.uint16LE = dv.getUint16(0, true);
    out.uint16BE = dv.getUint16(0, false);
    out.int16LE = dv.getInt16(0, true);
  }
  if (bytes.length >= 4) {
    out.uint32LE = dv.getUint32(0, true);
    out.float32LE = Number(dv.getFloat32(0, true).toFixed(4));
  }
  return out;
}

type CharSpec = {
  uuid: string;
  properties: string[];
  samples: Array<Record<string, unknown>>;
  lastValue?: string;
};
type ServiceSpec = { uuid: string; characteristics: CharSpec[] };

function GattInspector({ deviceId }: { deviceId: string }) {
  const [services, setServices] = useState<ServiceSpec[]>([]);
  const [status, setStatus] = useState("Discovering services…");

  useEffect(() => {
    setServices([]);
    setStatus("Discovering services…");

    const offDisc = bluetooth.on("discovered", (t: BleDiscovered) => {
      if (t.id !== deviceId) return;
      const mapped: ServiceSpec[] = (t.services || []).map((s) => ({
        uuid: s.uuid,
        characteristics: (s.characteristics || []).map((c) => ({
          uuid: c.uuid,
          properties: c.properties || [],
          samples: [],
        })),
      }));
      setServices(mapped);
      setStatus(`Found ${mapped.length} services. Reading & subscribing…`);

      for (const s of mapped) {
        for (const c of s.characteristics) {
          if (c.properties.includes("read")) bluetooth.read(deviceId, s.uuid, c.uuid);
          if (c.properties.includes("notify") || c.properties.includes("indicate"))
            bluetooth.subscribe(deviceId, s.uuid, c.uuid);
        }
      }
    });

    const offData = bluetooth.on("data", (e: BleDataEvent) => {
      if (e.id !== deviceId) return;
      setServices((prev) =>
        prev.map((s) =>
          s.uuid !== e.service
            ? s
            : {
                ...s,
                characteristics: s.characteristics.map((c) => {
                  if (c.uuid !== e.characteristic) return c;
                  const decoded = decodeAll(toBytes(e.value));
                  const samples = [...c.samples, { ts: Date.now(), raw: e.value, ...decoded }];
                  return {
                    ...c,
                    lastValue: e.value,
                    samples: samples.slice(-5),
                  };
                }),
              },
        ),
      );
    });

    bluetooth.discover(deviceId);

    return () => {
      offDisc();
      offData();
      setServices((cur) => {
        for (const s of cur)
          for (const c of s.characteristics)
            if (c.properties.includes("notify") || c.properties.includes("indicate"))
              bluetooth.unsubscribe(deviceId, s.uuid, c.uuid);
        return cur;
      });
    };
  }, [deviceId]);

  const spec = useMemo(
    () => ({ deviceId, capturedAt: new Date().toISOString(), services }),
    [deviceId, services],
  );

  const copyJson = () => {
    navigator.clipboard?.writeText(JSON.stringify(spec, null, 2));
  };
  const copyMd = () => {
    const lines: string[] = [`# GATT spec — ${deviceId}`, ""];
    for (const s of services) {
      lines.push(`## Service \`${s.uuid}\``);
      for (const c of s.characteristics) {
        lines.push(
          `- **${c.uuid}** _(props: ${c.properties.join(", ") || "—"})_`,
        );
        if (c.lastValue) lines.push(`  - last raw: \`${c.lastValue}\``);
        if (c.samples.length) {
          const last = c.samples[c.samples.length - 1];
          lines.push(`  - decoded: \`${JSON.stringify(last)}\``);
        }
      }
      lines.push("");
    }
    navigator.clipboard?.writeText(lines.join("\n"));
  };

  return (
    <div className="mt-6 rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-400">
            GATT profile
          </div>
          <div className="text-sm font-semibold text-gray-900">Watch spec · live</div>
          <div className="font-mono text-[10px] text-gray-400">{status}</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copyJson}
            className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-100"
          >
            <ClipboardCopy className="h-3 w-3" /> JSON
          </button>
          <button
            onClick={copyMd}
            className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-100"
          >
            <ClipboardCopy className="h-3 w-3" /> Markdown
          </button>
        </div>
      </div>

      {services.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-xs text-gray-400">
          Waiting for service discovery…
        </div>
      )}

      <div className="space-y-3">
        {services.map((s) => (
          <div key={s.uuid} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2 font-mono text-[11px] text-emerald-600">
              service · {s.uuid}
            </div>
            <div className="space-y-2">
              {s.characteristics.map((c) => (
                <div
                  key={c.uuid}
                  className="rounded-lg border border-gray-200 bg-white p-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-gray-700">
                      {c.uuid}
                    </span>
                    {c.properties.map((p) => (
                      <span
                        key={p}
                        className="rounded-md border border-gray-200 bg-gray-100 px-1.5 py-[1px] font-mono text-[9px] uppercase tracking-wider text-gray-500"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                  {c.samples.length > 0 && (
                    <pre className="mt-2 overflow-x-auto rounded-md bg-gray-100 p-2 font-mono text-[10px] leading-snug text-gray-600">
                      {JSON.stringify(c.samples[c.samples.length - 1], null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BluetoothPage() {
  const {
    devices,
    scanning,
    connectionState,
    connectedId,
    error,
    powerState,
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
    <div className="min-h-screen bg-vyro-canvas text-gray-900">
      <div className="mx-auto max-w-2xl px-5 py-8">
        <header className="mb-6 flex items-center gap-3">
          <a
            href="/"
            className="grid h-11 w-11 place-items-center rounded-2xl border border-gray-200 bg-gray-50 transition-colors hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </a>
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-gray-200 bg-gray-50">
            <Bluetooth className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-400">
              VYRO · Connectivity
            </div>
            <h1 className="text-2xl font-black text-gray-900">Bluetooth</h1>
          </div>
        </header>

        {!isNative && (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Desktop Chrome uses its built-in Bluetooth picker. Tap Start scan,
            select your watch in the popup, then this page will list and inspect
            it. iOS browsers still need the TestFlight build.
          </div>
        )}

        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => (scanning ? stopScan() : scan([], 10000))}
            className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100"
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
          <div className="font-mono text-xs text-gray-400">
            {scanning ? "Scanning…" : `${sorted.length} found`}
          </div>
          {isNative && powerState !== "unknown" && (
            <div
              className={`font-mono text-[10px] uppercase tracking-widest ${
                powerState === "on" ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              BT: {powerState}
            </div>
          )}
        </div>

        {isNative && powerState === "unauthorized" && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Bluetooth permission is denied. Open iOS Settings → VYRO → Bluetooth
            to allow.
          </div>
        )}
        {isNative && powerState === "off" && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Bluetooth is off. Turn it on from Control Center, then tap Start
            scan again.
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-2">
          {sorted.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-400">
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
                className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-gray-200 bg-gray-50">
                  <Wifi className="h-4 w-4 text-gray-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-gray-900">
                    {d.name || "Unknown device"}
                  </div>
                  <div className="truncate font-mono text-[10px] text-gray-400">
                    {d.id}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-end justify-end gap-[2px] h-4">
                    {[1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className={`w-[3px] rounded-sm ${
                          i <= bars ? "bg-emerald-500" : "bg-gray-200"
                        }`}
                        style={{ height: `${i * 3 + 3}px` }}
                      />
                    ))}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-gray-400">
                    {d.rssi ?? "—"} dBm · {rssiLabel(d.rssi)}
                  </div>
                </div>
                <button
                  onClick={() =>
                    isConnected ? disconnect(d.id) : connect(d.id)
                  }
                  disabled={isConnecting}
                  className={`ml-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    isConnected
                      ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                      : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
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

        {connectedId && <GattInspector deviceId={connectedId} />}
      </div>
    </div>
  );
}
