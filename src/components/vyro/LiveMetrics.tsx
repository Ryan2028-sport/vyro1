// Live firmware metrics, streamed from the VYRO band. Shows exactly the
// fields the wearable currently emits per VYRO_BLE_Packet_Reference v1:
//   - swing: intensity, accel peak (g), gyro peak (dps), duration (ms),
//            reference fwd/lr/ud g vectors
//   - rapid_start / burst: accel peak (g), jerk peak (g/s), gyro peak (dps),
//            duration (ms), reference fwd/lr g vectors
//   - direction_change: accel peak (g), gyro peak (dps), gap (ms),
//            prev/curr fwd-lr g vectors
// Plus running totals and an events-per-minute rate computed from the last
// 60 seconds of event timestamps.
import { useMemo } from "react";
import { Activity, Radio } from "lucide-react";
import { useVyroBandCtx } from "./VyroBandProvider";
import type { VyroMotionEvent } from "@/lib/vyro-ble/packets";

function fmtSat(v: { value: number; saturated: boolean }, unit: string, dp = 2) {
  const s = v.value.toFixed(dp);
  return v.saturated ? `≥${s}${unit}` : `${s}${unit}`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
      <div className="font-mono text-[9px] uppercase tracking-widest text-white/45">{label}</div>
      <div className="mt-1 text-base font-black tabular-nums">{value}</div>
      {hint && <div className="font-mono text-[9px] text-white/35">{hint}</div>}
    </div>
  );
}

function detailFields(ev: VyroMotionEvent): [string, string][] {
  switch (ev.type) {
    case "swing":
      return [
        ["Intensity", `${ev.intensity}`],
        ["Accel peak", fmtSat(ev.accelPeakG, "g")],
        ["Gyro peak", fmtSat(ev.gyroPeakDps, "dps", 0)],
        ["Duration", `${ev.durationMs} ms`],
        ["Ref fwd", fmtSat(ev.refFwdG, "g")],
        ["Ref l/r", fmtSat(ev.refLrG, "g")],
        ["Ref u/d", fmtSat(ev.refUdG, "g")],
      ];
    case "rapid_start":
    case "burst":
      return [
        ["Accel peak", fmtSat(ev.accelPeakG, "g")],
        ["Jerk peak", fmtSat(ev.jerkPeakGps, "g/s", 0)],
        ["Gyro peak", fmtSat(ev.gyroPeakDps, "dps", 0)],
        ["Duration", `${ev.durationMs} ms`],
        ["Ref fwd", fmtSat(ev.refFwdG, "g")],
        ["Ref l/r", fmtSat(ev.refLrG, "g")],
      ];
    case "direction_change":
      return [
        ["Accel peak", fmtSat(ev.accelPeakG, "g")],
        ["Gyro peak", fmtSat(ev.gyroPeakDps, "dps", 0)],
        ["Gap", `${ev.gapMs} ms`],
        ["Prev fwd", fmtSat(ev.prevFwdG, "g")],
        ["Prev l/r", fmtSat(ev.prevLrG, "g")],
        ["Curr fwd", fmtSat(ev.currFwdG, "g")],
        ["Curr l/r", fmtSat(ev.currLrG, "g")],
      ];
  }
}

export function LiveMetrics() {
  const { ble, connected, pairedName, events, counts, sessionState } = useVyroBandCtx();
  const last = events.length ? events[events.length - 1].event : null;

  const ratePerMin = useMemo(() => {
    const now = Date.now();
    const within = events.filter((e) => now - e.ts <= 60_000).length;
    return within;
  }, [events]);

  const lastSwing = useMemo(
    () => [...events].reverse().find((e) => e.event.type === "swing")?.event,
    [events],
  );
  const lastBurst = useMemo(
    () =>
      [...events]
        .reverse()
        .find((e) => e.event.type === "burst" || e.event.type === "rapid_start")?.event,
    [events],
  );

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Radio className={`h-4 w-4 ${connected ? "text-emerald-300" : "text-white/40"}`} />
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
          Live from band · {pairedName || "VYRO Motion"}
        </div>
        <span
          className={`ml-auto rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${
            connected
              ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
              : "border-white/15 bg-white/[0.04] text-white/55"
          }`}
        >
          {connected
            ? sessionState === "live"
              ? "Live · Session"
              : "Live"
            : ble.connectionState === "connecting"
              ? "Reconnecting…"
              : "Offline"}
        </span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        <Stat label="Swings" value={`${counts.swing}`} />
        <Stat label="Rapid starts" value={`${counts.rapid_start}`} />
        <Stat label="Bursts" value={`${counts.burst}`} />
        <Stat label="Dir Δ" value={`${counts.direction_change}`} />
        <Stat label="Events / min" value={`${ratePerMin}`} hint="rolling 60s" />
      </div>

      {!connected ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-4 text-center text-xs text-white/50">
          Band is offline. The app keeps trying to reconnect automatically — open
          <span className="px-1 font-semibold text-white/80">Profile &amp; Band</span>
          to pair if you have not yet.
        </div>
      ) : last ? (
        <>
          <div className="mb-1.5 flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-emerald-300" />
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/55">
              Last event · {last.type.replace("_", " ")}
            </div>
            <div className="ml-auto font-mono text-[10px] text-white/40">
              {new Date(events[events.length - 1].ts).toLocaleTimeString()}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
            {detailFields(last).map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5"
              >
                <span className="font-mono text-[10px] uppercase tracking-widest text-white/45">{k}</span>
                <span className="font-mono text-[11px] tabular-nums text-white/90">{v}</span>
              </div>
            ))}
          </div>

          {(lastSwing || lastBurst) && (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {lastSwing && lastSwing.type === "swing" && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-white/45">
                    Last swing
                  </div>
                  <div className="mt-1 text-sm">
                    Intensity <b>{lastSwing.intensity}</b> ·{" "}
                    {fmtSat(lastSwing.accelPeakG, "g")} ·{" "}
                    {fmtSat(lastSwing.gyroPeakDps, "dps", 0)} · {lastSwing.durationMs}ms
                  </div>
                </div>
              )}
              {lastBurst && (lastBurst.type === "burst" || lastBurst.type === "rapid_start") && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-white/45">
                    Last {lastBurst.type.replace("_", " ")}
                  </div>
                  <div className="mt-1 text-sm">
                    {fmtSat(lastBurst.accelPeakG, "g")} ·{" "}
                    {fmtSat(lastBurst.jerkPeakGps, "g/s", 0)} · {lastBurst.durationMs}ms
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-4 text-center text-xs text-white/50">
          Connected. Move the band to start streaming events.
        </div>
      )}
    </section>
  );
}
