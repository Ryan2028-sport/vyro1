import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  Bluetooth,
  CheckCircle2,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { runOtaUpload, type OtaProgress } from "@/lib/vyro-ble/ota";
import {
  openSmpTransport,
  requestVyroBand,
} from "@/lib/vyro-ble/web-transport";
import { useVyroBand } from "@/hooks/use-vyro-band";
import type { VyroMotionEvent } from "@/lib/vyro-ble/packets";

export const Route = createFileRoute("/watch")({
  component: WatchPage,
  head: () => ({
    meta: [
      { title: "Watch · VYRO" },
      {
        name: "description",
        content:
          "Pair the VYRO band, see live motion events, and push firmware updates over Bluetooth.",
      },
    ],
  }),
});

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

function WatchPage() {
  const vyro = useVyroBand();
  const { ble, connected, events, counts, sessionState, sport, setSport } = vyro;

  const [otaFile, setOtaFile] = useState<File | null>(null);
  const [otaProgress, setOtaProgress] = useState<OtaProgress | null>(null);
  const [otaError, setOtaError] = useState<string | null>(null);
  const [otaSuccess, setOtaSuccess] = useState(false);
  const otaInputRef = useRef<HTMLInputElement>(null);

  const runOta = useCallback(async () => {
    if (!otaFile) return;
    setOtaError(null);
    setOtaSuccess(false);
    setOtaProgress({
      fraction: 0,
      bytesSent: 0,
      bytesTotal: otaFile.size,
      phase: "hashing",
    });
    try {
      const ab = await otaFile.arrayBuffer();
      const image = new Uint8Array(ab);
      const device = await requestVyroBand();
      const transport = await openSmpTransport(device);
      await runOtaUpload(transport, {
        image,
        onProgress: setOtaProgress,
      });
      setOtaProgress({
        fraction: 1,
        bytesSent: otaFile.size,
        bytesTotal: otaFile.size,
        phase: "done",
      });
      setOtaSuccess(true);
    } catch (err) {
      setOtaError((err as Error)?.message || String(err));
    }
  }, [otaFile]);

  // Auto-scan once on mount so the existing devices list populates.
  useEffect(() => {
    if (!ble.scanning && ble.devices.length === 0) {
      void ble.scan([], 8000);
    }
    // intentionally only run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),transparent_28%),linear-gradient(180deg,#080808,#000)] text-white">
      <div className="mx-auto max-w-2xl px-5 py-8">
        <header className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/15 bg-white/[0.06]">
            <Bluetooth className="h-5 w-5" />
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
              VYRO · Wearable
            </div>
            <h1 className="text-2xl font-black">Watch</h1>
          </div>
          <div className="ml-auto">
            <span
              className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest ${
                connected
                  ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
                  : "border-white/15 bg-white/[0.04] text-white/55"
              }`}
            >
              {connected ? "Connected" : "Not paired"}
            </span>
          </div>
        </header>

        {/* PAIRING */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
                Pairing
              </div>
              <div className="text-sm font-semibold">
                {connected ? "Band linked" : "Scan and connect"}
              </div>
            </div>
            <button
              onClick={() =>
                ble.scanning ? ble.stopScan() : ble.scan([], 8000)
              }
              className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/[0.06] px-3 py-2 text-xs font-semibold hover:bg-white/[0.12]"
            >
              {ble.scanning ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Stop
                </>
              ) : (
                "Scan"
              )}
            </button>
          </div>
          {ble.error && (
            <div className="mb-2 rounded-lg border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-xs text-red-200">
              {ble.error}
            </div>
          )}
          <div className="space-y-1.5">
            {ble.devices.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-6 text-center text-xs text-white/45">
                {ble.scanning ? "Scanning…" : "No devices yet. Tap Scan."}
              </div>
            )}
            {ble.devices.map((d) => {
              const isConn = ble.connectedId === d.id;
              return (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {d.name || "Unknown"}
                    </div>
                    <div className="truncate font-mono text-[10px] text-white/40">
                      {d.id}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      isConn ? ble.disconnect(d.id) : ble.connect(d.id)
                    }
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                      isConn
                        ? "border-red-500/40 bg-red-500/10 text-red-200"
                        : "border-white/20 bg-white/[0.08]"
                    }`}
                  >
                    {isConn ? "Disconnect" : "Connect"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* SESSION CONTROL */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
                Session
              </div>
              <div className="text-sm font-semibold capitalize">
                {sessionState} · {sport}
              </div>
            </div>
            <div className="flex gap-1.5">
              {(["squash", "tennis"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSport(s)}
                  className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                    sport === s
                      ? "border-white/40 bg-white/[0.18]"
                      : "border-white/15 bg-white/[0.04] text-white/60"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={!connected || sessionState === "live"}
              onClick={() => vyro.startSession()}
              className="flex-1 rounded-xl bg-white px-4 py-2 text-sm font-bold text-black disabled:opacity-30"
            >
              Start
            </button>
            <button
              disabled={!connected || sessionState !== "live"}
              onClick={() => vyro.pauseSession()}
              className="flex-1 rounded-xl border border-white/20 bg-white/[0.06] px-4 py-2 text-sm font-bold disabled:opacity-30"
            >
              Pause
            </button>
            <button
              disabled={!connected || sessionState === "idle"}
              onClick={() => vyro.endSession()}
              className="flex-1 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm font-bold text-red-200 disabled:opacity-30"
            >
              End
            </button>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {(
              [
                ["Swings", counts.swing],
                ["Rapid", counts.rapid_start],
                ["Bursts", counts.burst],
                ["Dir Δ", counts.direction_change],
              ] as const
            ).map(([label, n]) => (
              <div
                key={label}
                className="rounded-lg border border-white/10 bg-black/30 px-2 py-2"
              >
                <div className="font-mono text-[9px] uppercase tracking-widest text-white/45">
                  {label}
                </div>
                <div className="text-lg font-black tabular-nums">{n}</div>
              </div>
            ))}
          </div>
        </section>

        {/* EVENT FEED */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-300" />
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
              Live motion feed
            </div>
            <div className="ml-auto font-mono text-[10px] text-white/40">
              {events.length} events
            </div>
          </div>
          <div className="max-h-72 space-y-1 overflow-auto">
            {events.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-6 text-center text-xs text-white/45">
                {connected
                  ? "Connected. Move the band to see events."
                  : "Pair the band to start receiving events."}
              </div>
            ) : (
              [...events].reverse().map((e, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5"
                >
                  <span className="rounded-md border border-white/15 bg-white/[0.06] px-1.5 py-[1px] font-mono text-[10px] uppercase text-white/70">
                    {e.event.type.replace("_", " ")}
                  </span>
                  <span className="flex-1 truncate font-mono text-[11px] text-white/75">
                    {summarise(e.event)}
                  </span>
                  <span className="font-mono text-[10px] text-white/35">
                    {new Date(e.ts).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* OTA */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Upload className="h-4 w-4 text-sky-300" />
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
              Firmware update (OTA)
            </div>
          </div>
          <p className="mb-3 text-xs text-white/55">
            Upload a signed MCUboot image (<code>app_update.bin</code>) produced
            by <code>west build</code>. The band reboots into the new image and
            auto-reverts if confirmation fails.
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
              className="rounded-xl border border-white/20 bg-white/[0.06] px-3 py-2 text-xs font-semibold hover:bg-white/[0.12]"
            >
              Choose file
            </button>
            <div className="min-w-0 flex-1 truncate font-mono text-[11px] text-white/55">
              {otaFile ? `${otaFile.name} · ${(otaFile.size / 1024).toFixed(1)} KB` : "No file selected"}
            </div>
            <button
              disabled={!otaFile || (!!otaProgress && otaProgress.phase !== "done" && !otaError)}
              onClick={runOta}
              className="rounded-xl bg-sky-400 px-4 py-2 text-xs font-bold text-black disabled:opacity-30"
            >
              {otaProgress && otaProgress.phase !== "done" && !otaError
                ? "Updating…"
                : "Start update"}
            </button>
          </div>

          {otaProgress && (
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-white/55">
                <span>{phaseLabel[otaProgress.phase]}</span>
                <span>
                  {(otaProgress.fraction * 100).toFixed(1)}% · {Math.round(otaProgress.bytesSent / 1024)} / {Math.round(otaProgress.bytesTotal / 1024)} KB
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-sky-400 transition-all"
                  style={{ width: `${otaProgress.fraction * 100}%` }}
                />
              </div>
            </div>
          )}
          {otaSuccess && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">
              <CheckCircle2 className="h-4 w-4" /> Firmware uploaded. Band is rebooting — reconnect once it comes back to confirm the swap.
            </div>
          )}
          {otaError && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              <XCircle className="h-4 w-4" /> {otaError}
            </div>
          )}

          <p className="mt-3 text-[11px] text-white/40">
            OTA uses Nordic MCUmgr SMP over BLE. Works in Chrome / Edge on
            desktop; the iOS native build needs binary BLE write support added
            to the bridge before OTA runs there.
          </p>
        </section>
      </div>
    </div>
  );
}
