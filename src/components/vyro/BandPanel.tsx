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
    if (!ble.scanning && ble.devices.length === 0) void ble.scan([], 8000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    uploading: "Uploading firmware…",
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
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-black/10 bg-black/[0.03]">
            <Bluetooth className="h-4 w-4 text-black/70" />
          </div>
          <div className="min-w-0 flex-1 text-[11px] text-black/55">
            {ble.scanning ? "Scanning for nearby bands…" : "Tap scan to find your band"}
          </div>
          <button
            onClick={() => (ble.scanning ? ble.stopScan() : ble.scan([], 8000))}
            className="shrink-0 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-black/[0.04]"
          >
            {ble.scanning ? "Stop" : "Scan"}
          </button>
        </div>
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
                className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.07] bg-black/[0.02] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-black">{d.name || "Unknown"}</div>
                  <div className="truncate font-mono text-[10px] text-black/45">{d.id}</div>
                </div>
                <button
                  onClick={() => (isConn ? ble.disconnect(d.id) : ble.connect(d.id))}
                  className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                    isConn
                      ? "border-rose-500/30 bg-rose-50 text-rose-700"
                      : "border-black/10 bg-white text-black hover:bg-black/[0.04]"
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
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-black/45">
            <Activity className="h-3 w-3" /> {events.length}
          </span>
        }
      >
        <div className="max-h-64 space-y-1 overflow-auto">
          {events.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/15 bg-black/[0.02] px-3 py-6 text-center text-xs text-black/45">
              {connected ? "Move the band to see events." : "Pair the band to start receiving events."}
            </div>
          ) : (
            [...events].reverse().map((e, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-lg border border-black/[0.05] bg-black/[0.02] px-2.5 py-1.5"
              >
                <span className="shrink-0 rounded-md border border-black/10 bg-white px-1.5 py-[1px] font-mono text-[10px] uppercase text-black/70">
                  {e.event.type.replace("_", " ")}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-black/70">{summarise(e.event)}</span>
                <span className="shrink-0 font-mono text-[10px] text-black/40">{new Date(e.ts).toLocaleTimeString()}</span>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* OTA */}
      <Card eyebrow="Firmware" title="Over-the-air update">
        <p className="mb-3 text-xs leading-relaxed text-black/60">
          Upload a signed MCUboot image (<code className="rounded bg-black/[0.05] px-1 py-0.5 font-mono text-[10px]">app_update.bin</code>). Band reboots into the new image and auto-reverts if confirmation fails.
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
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-black/[0.04]"
          >
            Choose file
          </button>
          <div className="min-w-0 flex-1 truncate font-mono text-[11px] text-black/55">
            {otaFile ? `${otaFile.name} · ${(otaFile.size / 1024).toFixed(1)} KB` : "No file selected"}
          </div>
          <button
            disabled={!otaFile || (!!otaProgress && otaProgress.phase !== "done" && !otaError)}
            onClick={runOta}
            className="rounded-xl bg-black px-4 py-2 text-xs font-bold text-white disabled:opacity-30"
          >
            {otaProgress && otaProgress.phase !== "done" && !otaError ? "Updating…" : "Start update"}
          </button>
        </div>
        {otaProgress && (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest text-black/55">
              <span className="truncate">{phaseLabel[otaProgress.phase]}</span>
              <span className="shrink-0">{(otaProgress.fraction * 100).toFixed(0)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${otaProgress.fraction * 100}%` }} />
            </div>
          </div>
        )}
        {otaSuccess && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Firmware uploaded. Band is rebooting — reconnect once it returns.
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
