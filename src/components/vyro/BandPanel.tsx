// Pairing + live event feed + OTA firmware uploader. Used inside Profile.
// Light-theme to match the rest of the app on mobile.
import { Activity, Bluetooth, CheckCircle2, Upload, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { runOtaUpload, type OtaProgress } from "@/lib/vyro-ble/ota";
import { openSmpTransport, requestVyroBand } from "@/lib/vyro-ble/web-transport";
import { useVyroBandCtx } from "./VyroBandProvider";
import type { VyroMotionEvent } from "@/lib/vyro-ble/packets";
import { useServerFn } from "@tanstack/react-start";
import { updateMyProfile } from "@/lib/profile.functions";
import { Card, Pill } from "./shared";
import { QCBAND_SERVICE_UUID } from "@/lib/vyro-ble/qcband";


function fmtSat(v: { value: number; saturated: boolean }, unit: string, dp = 2) {
  const s = v.value.toFixed(dp);
  return v.saturated ? `≥${s}${unit}` : `${s}${unit}`;
}
function summarise(ev: VyroMotionEvent): string {
  switch (ev.type) {
    case "swing":
      return `int ${ev.intensity} · ${fmtSat(ev.accelPeakG, "g")} · ${fmtSat(ev.gyroPeakDps, "dps", 0)} · ${ev.durationMs}ms`;
    case "rapid_start":
    case "burst":
      return `${fmtSat(ev.accelPeakG, "g")} · ${fmtSat(ev.jerkPeakGps, "g/s", 0)} · ${ev.durationMs}ms`;
    case "direction_change":
      return `${fmtSat(ev.accelPeakG, "g")} · gap ${ev.gapMs}ms`;
  }
}

function sameDeviceId(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const clean = (v: string) => v.toLowerCase().replace(/[^a-f0-9]/g, "");
  return clean(a) !== "" && clean(a) === clean(b);
}

function isLikelyBand(device: { name?: string; services?: string[] }): boolean {
  const name = (device.name || "").toLowerCase();
  const services = (device.services || []).map((s) => s.toLowerCase());
  return (
    /vyro|qc|band|watch|oudmon|smart/i.test(name) ||
    services.some(
      (s) =>
        s.includes(QCBAND_SERVICE_UUID.toLowerCase()) ||
        s.includes("180d") ||
        s.includes("180f"),
    )
  );
}

export function BandPanel({
  pairedId,
  pairedName,
  defaultSport = "squash",
}: {
  pairedId: string | null | undefined;
  pairedName: string | null | undefined;
  defaultSport?: "squash" | "tennis";
}) {
  const vyro = useVyroBandCtx();
  const { ble, connected, events, sessionState: _s, sport: _sp, setSport } = vyro;
  const updateProfile = useServerFn(updateMyProfile);

  useEffect(() => {
    setSport(defaultSport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultSport]);

  useEffect(() => {
    if (!ble.scanning && ble.devices.length === 0) {
      console.log("[BandPanel] kicking initial scan", { isNative: ble.isNative, powerState: ble.powerState });
      void ble.scan([], 8000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Count device-discovery callbacks so the user can see whether the native
  // BLE bridge is firing onBleDevice at all (vs the JS layer dropping them).
  const [discoveryTicks, setDiscoveryTicks] = useState(0);
  useEffect(() => {
    setDiscoveryTicks((n) => n + 1);
  }, [ble.devices.length]);

  useEffect(() => {
    if (connected || ble.connectionState === "connecting") return;
    const target = pairedId
      ? ble.devices.find((d) => sameDeviceId(d.id, pairedId))
      : ble.devices.filter(isLikelyBand).length === 1
        ? ble.devices.filter(isLikelyBand)[0]
        : null;
    if (target) void ble.connect(target.id);
  }, [pairedId, connected, ble.connectionState, ble.devices, ble.connect]);

  useEffect(() => {
    if (!ble.connectedId) return;
    const dev = ble.devices.find((d) => d.id === ble.connectedId);
    if (!dev) return;
    if (pairedId === ble.connectedId) return;
    void updateProfile({
      data: { paired_band_id: dev.id, paired_band_name: dev.name || "VYRO band" },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ble.connectedId]);

  // OTA
  const [otaFile, setOtaFile] = useState<File | null>(null);
  const [otaProgress, setOtaProgress] = useState<OtaProgress | null>(null);
  const [otaError, setOtaError] = useState<string | null>(null);
  const [otaSuccess, setOtaSuccess] = useState(false);
  const otaInputRef = useRef<HTMLInputElement>(null);

  const runOta = useCallback(async () => {
    if (!otaFile) return;
    setOtaError(null);
    setOtaSuccess(false);
    setOtaProgress({ fraction: 0, bytesSent: 0, bytesTotal: otaFile.size, phase: "hashing" });
    try {
      const image = new Uint8Array(await otaFile.arrayBuffer());
      const device = await requestVyroBand();
      const transport = await openSmpTransport(device);
      await runOtaUpload(transport, { image, onProgress: setOtaProgress });
      setOtaProgress({ fraction: 1, bytesSent: otaFile.size, bytesTotal: otaFile.size, phase: "done" });
      setOtaSuccess(true);
    } catch (e) {
      setOtaError((e as Error)?.message || String(e));
    }
  }, [otaFile]);

  const phaseLabel: Record<OtaProgress["phase"], string> = {
    hashing: "Hashing image…",
    uploading: "Installing update…",
    marking_test: "Marking image for test…",
    resetting: "Resetting band…",
    waiting_reconnect: "Waiting for band to reconnect…",
    confirming: "Confirming…",
    done: "Update complete",
  };

  return (
    <div className="space-y-4">
      {/* Pair / status */}
      <Card
        eyebrow="Band"
        title={
          connected
            ? ble.devices.find((d) => d.id === ble.connectedId)?.name || "Connected"
            : pairedName || "Not paired"
        }
        action={<Pill tone={connected ? "live" : "off"} pulse={connected}>{connected ? "Live" : "Offline"}</Pill>}
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-vyro-text/10 bg-vyro-text/[0.03]">
            <Bluetooth className="h-4 w-4 text-vyro-text/70" />
          </div>
          <div className="min-w-0 flex-1 text-[11px] text-vyro-text/55">
            {ble.scanning ? "Scanning for nearby bands…" : "Tap scan to find your band"}
          </div>
          <button
            onClick={() => {
              if (ble.scanning) void ble.stopScan();
              else if (pairedId) void ble.connect(pairedId);
              else void ble.scan([], 8000);
            }}
            className="shrink-0 rounded-lg border border-vyro-text/10 bg-vyro-panel px-3 py-1.5 text-xs font-semibold text-vyro-text hover:bg-vyro-text/[0.04]"
          >
            {ble.scanning ? "Stop" : "Scan"}
          </button>
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-vyro-text/55">
          <span className="rounded-md border border-vyro-text/10 bg-vyro-panel px-1.5 py-[1px]">
            bridge: {ble.isNative ? "native" : "web"}
          </span>
          <span
            className={`rounded-md border px-1.5 py-[1px] ${
              ble.powerState === "on"
                ? "border-emerald-500/30 bg-emerald-50 text-emerald-700"
                : ble.powerState === "unauthorized"
                  ? "border-rose-500/30 bg-rose-50 text-rose-700"
                  : "border-vyro-text/10 bg-vyro-panel"
            }`}
          >
            bt: {ble.powerState}
          </span>
          <span className="rounded-md border border-vyro-text/10 bg-vyro-panel px-1.5 py-[1px]">
            scan: {ble.scanning ? "on" : "idle"}
          </span>
          <span className="rounded-md border border-vyro-text/10 bg-vyro-panel px-1.5 py-[1px]">
            found: {ble.devices.length} (ticks {discoveryTicks})
          </span>
          {ble.lastData && (
            <span className="rounded-md border border-vyro-text/10 bg-vyro-panel px-1.5 py-[1px]">
              data: {ble.lastData.characteristic.slice(0, 8)}
            </span>
          )}
        </div>
        {ble.powerState !== "on" && ble.isNative && (
          <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Bluetooth state is <span className="font-mono">{ble.powerState}</span>. Tap Scan to trigger the iOS Bluetooth permission prompt, then enable it in Settings → VYRO → Bluetooth if it was previously denied.
          </div>
        )}
        {ble.error && (
          <div className="mb-2 rounded-lg border border-rose-500/30 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {ble.error}
          </div>
        )}
        <div className="space-y-1.5">
          {ble.devices.map((d) => {
            const isConn = ble.connectedId === d.id;
            return (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-vyro-text/[0.07] bg-vyro-text/[0.02] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-vyro-text">{d.name || "Unknown"}</div>
                  <div className="truncate font-mono text-[10px] text-vyro-text/45">{d.id}</div>
                </div>
                <button
                  onClick={() => (isConn ? ble.disconnect(d.id) : ble.connect(d.id))}
                  className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                    isConn
                      ? "border-rose-500/30 bg-rose-50 text-rose-700"
                      : "border-vyro-text/10 bg-vyro-panel text-vyro-text hover:bg-vyro-text/[0.04]"
                  }`}
                >
                  {isConn ? "Disconnect" : "Connect"}
                </button>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Live feed */}
      <Card
        eyebrow="Live motion"
        title="Recent events"
        action={
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-vyro-text/45">
            <Activity className="h-3 w-3" /> {events.length}
          </span>
        }
      >
        <div className="max-h-64 space-y-1 overflow-auto">
          {events.length === 0 ? (
            <div className="rounded-xl border border-dashed border-vyro-text/15 bg-vyro-text/[0.02] px-3 py-6 text-center text-xs text-vyro-text/45">
              {connected ? "Move the band to see events." : "Pair the band to start receiving events."}
            </div>
          ) : (
            [...events].reverse().map((e, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-lg border border-vyro-text/[0.05] bg-vyro-text/[0.02] px-2.5 py-1.5"
              >
                <span className="shrink-0 rounded-md border border-vyro-text/10 bg-vyro-panel px-1.5 py-[1px] font-mono text-[10px] uppercase text-vyro-text/70">
                  {e.event.type.replace("_", " ")}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-vyro-text/70">{summarise(e.event)}</span>
                <span className="shrink-0 font-mono text-[10px] text-vyro-text/40">{new Date(e.ts).toLocaleTimeString()}</span>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* OTA */}
      <Card eyebrow="Update" title="Watch software update">
        <p className="mb-3 text-xs leading-relaxed text-vyro-text/60">
          Choose an update file to install on your watch. It will restart and
          reconnect automatically once the update finishes.
        </p>
        <input
          ref={otaInputRef}
          type="file"
          accept=".bin"
          className="hidden"
          onChange={(e) => {
            setOtaFile(e.target.files?.[0] ?? null);
            setOtaError(null);
            setOtaSuccess(false);
            setOtaProgress(null);
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => otaInputRef.current?.click()}
            className="rounded-xl border border-vyro-text/10 bg-vyro-panel px-3 py-2 text-xs font-semibold text-vyro-text hover:bg-vyro-text/[0.04]"
          >
            Choose file
          </button>
          <div className="min-w-0 flex-1 truncate font-mono text-[11px] text-vyro-text/55">
            {otaFile ? `${otaFile.name} · ${(otaFile.size / 1024).toFixed(1)} KB` : "No file selected"}
          </div>
          <button
            disabled={!otaFile || (!!otaProgress && otaProgress.phase !== "done" && !otaError)}
            onClick={runOta}
            className="rounded-xl bg-vyro-mint px-4 py-2 text-xs font-bold text-vyro-ink disabled:opacity-30"
          >
            {otaProgress && otaProgress.phase !== "done" && !otaError ? "Updating…" : "Start update"}
          </button>
        </div>
        {otaProgress && (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest text-vyro-text/55">
              <span className="truncate">{phaseLabel[otaProgress.phase]}</span>
              <span className="shrink-0">{(otaProgress.fraction * 100).toFixed(0)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-vyro-text/[0.06]">
              <div className="h-full bg-vyro-mint/100 transition-all" style={{ width: `${otaProgress.fraction * 100}%` }} />
            </div>
          </div>
        )}
        {otaSuccess && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-vyro-mint/10 px-3 py-2 text-xs text-vyro-mint">
            <CheckCircle2 className="h-4 w-4" /> Update installed. Your watch is restarting — it will reconnect automatically.
          </div>
        )}
        {otaError && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <XCircle className="h-4 w-4" /> {otaError}
          </div>
        )}
      </Card>
    </div>
  );
}
