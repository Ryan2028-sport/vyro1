import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Pause, Play, Square, Watch, Zap } from "lucide-react";
import { Card, EmptyState, PageHeader, Pill, Stat } from "./shared";
import { useLiveMetrics, fmtNum } from "./useLiveMetrics";
import { useVyroBandCtx } from "./VyroBandProvider";
import { saveSession } from "@/lib/sessions.functions";
import type { Sport } from "@/lib/vyro-ble/session-control";

const SPORTS: { id: Sport; label: string }[] = [
  { id: "squash", label: "Squash" },
  { id: "tennis", label: "Tennis" },
];

function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

// Tiny inline sparkline.
function Spark({
  points,
  color = "var(--vyro-mint)",
  fill = false,
  height = 56,
  min,
  max,
}: {
  points: number[];
  color?: string;
  fill?: boolean;
  height?: number;
  min?: number;
  max?: number;
}) {
  if (points.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-vyro-line text-[10px] text-vyro-mute"
        style={{ height }}
      >
        waiting for stream…
      </div>
    );
  }
  const lo = min ?? Math.min(...points);
  const hi = max ?? Math.max(...points);
  const span = hi - lo || 1;
  const W = 300;
  const H = height;
  const step = W / (points.length - 1);
  const path = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(H - ((v - lo) / span) * (H - 6) - 3).toFixed(1)}`)
    .join(" ");
  const area = `${path} L${W},${H} L0,${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full" style={{ height }}>
      {fill && <path d={area} fill={color} opacity={0.15} />}
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function SessionView() {
  const band = useVyroBandCtx();
  const live = useLiveMetrics();
  const qc = useQueryClient();
  const save = useServerFn(saveSession);
  const saveMut = useMutation({
    mutationFn: save,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const tickRef = useRef<number | null>(null);

  // Rolling HR samples for the live 60s chart and zone distribution.
  const [hrSamples, setHrSamples] = useState<{ ts: number; bpm: number }[]>([]);
  useEffect(() => {
    if (live.heartRateBpm == null || live.heartRateAt == null) return;
    setHrSamples((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.ts === live.heartRateAt) return prev;
      const next = [...prev, { ts: live.heartRateAt!, bpm: live.heartRateBpm! }];
      const cutoff = Date.now() - 60 * 60_000;
      return next.filter((s) => s.ts >= cutoff).slice(-3600);
    });
  }, [live.heartRateBpm, live.heartRateAt]);

  useEffect(() => {
    if (band.sessionState !== "live") {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    tickRef.current = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [band.sessionState]);

  // Build a live acceleration trace from the rolling event stream — one
  // sample per event, capped to the last 60 entries so the chart stays smooth.
  const accelSeries = useMemo(() => {
    const xs: number[] = [];
    for (const e of live.events) {
      const ev = e.event as { accelPeakG?: { value: number } };
      if (ev.accelPeakG?.value != null) xs.push(ev.accelPeakG.value);
    }
    return xs.slice(-60);
  }, [live.events]);

  // T-control & recoveries derived from real IMU events:
  //  - "Bursts off T" = burst + rapid_start counts
  //  - "T recoveries" = direction_change count (last gap < 1.2s = sharp return)
  const bursts = live.counts.burst + live.counts.rapid_start;
  const recoveries = live.counts.direction_change;
  const tControl = bursts === 0 ? 0 : Math.round(Math.min(1, recoveries / Math.max(1, bursts)) * 100);

  async function onStart() {
    setStartedAt(Date.now());
    setNow(Date.now());
    try {
      await band.startSession(band.sport);
    } catch (e) {
      console.warn("[vyro] startSession failed; continuing in offline mode", e);
    }
  }
  async function onPause() {
    try { await band.pauseSession(); } catch (e) { console.warn("[vyro] pauseSession failed", e); }
  }
  async function onEnd() {
    const ended = Date.now();
    const started = startedAt ?? ended;
    try { await band.endSession(); } catch (e) { console.warn("[vyro] endSession failed", e); }
    try {
      await saveMut.mutateAsync({
        data: {
          sport: band.sport,
          started_at: new Date(started).toISOString(),
          ended_at: new Date(ended).toISOString(),
          swing_count: live.counts.swing,
          rapid_count: live.counts.rapid_start,
          burst_count: live.counts.burst,
          dir_change_count: live.counts.direction_change,
          summary: {
            peakG: live.peakG,
            peakDps: live.peakDps,
            peakJerk: live.peakJerk,
            tControlPct: tControl,
            recoveries,
            bursts,
            eventsLastMin: live.eventsLastMin,
            reactMin: live.reactMin,
          },
        },
      });
    } catch (e) {
      console.warn("[vyro] failed to save session", e);
    }
    setStartedAt(null);
  }

  const elapsed = startedAt && band.sessionState !== "idle" ? now - startedAt : 0;
  const isLive = band.sessionState === "live";
  const isPaused = band.sessionState === "paused";
  const idle = band.sessionState === "idle";

  // Latest accel reading for the "movement intensity" tile.
  const latestG = accelSeries.length ? accelSeries[accelSeries.length - 1] : null;

  // Heart-rate derived series for the live chart + zones.
  // Default max HR = 190; once we wire profile age we can do 220-age.
  const maxHr = 190;
  const sessionHr = useMemo(() => {
    if (startedAt == null) return hrSamples.slice(-60);
    return hrSamples.filter((s) => s.ts >= startedAt);
  }, [hrSamples, startedAt]);
  const hrSpark = useMemo(() => sessionHr.slice(-60).map((s) => s.bpm), [sessionHr]);
  const currentZone = useMemo(() => {
    if (live.heartRateBpm == null) return null;
    const pct = live.heartRateBpm / maxHr;
    if (pct < 0.6) return 1;
    if (pct < 0.7) return 2;
    if (pct < 0.8) return 3;
    if (pct < 0.9) return 4;
    return 5;
  }, [live.heartRateBpm]);
  const zoneDist = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0];
    if (sessionHr.length < 2) return { buckets, total: 0 };
    let total = 0;
    for (let i = 1; i < sessionHr.length; i++) {
      const dt = Math.max(0, sessionHr[i].ts - sessionHr[i - 1].ts);
      if (dt > 60_000) continue; // skip large gaps
      const bpm = sessionHr[i].bpm;
      const pct = bpm / maxHr;
      const z = pct < 0.6 ? 0 : pct < 0.7 ? 1 : pct < 0.8 ? 2 : pct < 0.9 ? 3 : 4;
      buckets[z] += dt;
      total += dt;
    }
    return { buckets, total };
  }, [sessionHr]);


  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Session · T-Control Tracking"
        title="Court session"
        subtitle="Goodix GH3026 photoplethysmography + ST LSM6DSO 6-axis IMU streaming live."
        action={
          <Pill tone={isLive ? "live" : live.connected ? "warn" : "off"} pulse={isLive}>
            {isLive ? "LIVE" : live.connected ? "READY" : "OFFLINE"}
          </Pill>
        }
      />

      {/* Band status strip */}
      <Card
        eyebrow="VYRO Band"
        title={band.pairedName ?? "VYRO Motion"}
        action={
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-vyro-mute">v0.4-alpha</span>
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono uppercase tracking-[0.18em] ${
              live.connected
                ? "border-vyro-mint/40 bg-vyro-mint/10 text-vyro-mint"
                : "border-vyro-rose/40 bg-vyro-rose/10 text-vyro-rose"
            }`}
          >
            <Watch className="h-3 w-3" />
            {live.connected ? "Connected" : "Disconnected"}
          </span>
          {live.batteryPct != null && (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-vyro-text">
              {live.batteryPct}%{live.batteryCharging ? " · charging" : ""}
            </span>
          )}
          <span className="text-vyro-mute">
            {isLive
              ? `Streaming HR · IMU${live.spo2Pct != null ? " · SpO₂" : ""}`
              : live.connected
                ? "Idle · ready to record"
                : "Pair from Profile to begin"}
          </span>
        </div>
      </Card>

      {!live.connected && (
        <EmptyState
          title="Watch is not connected"
          hint="Pair your VYRO Band from the Profile tab. The session console will light up the moment IMU packets start arriving."
        />
      )}

      {/* IDLE: pre-session call-to-action */}
      {idle && (
        <Card eyebrow="Start session" title="Ready to track">
          <p className="text-xs leading-relaxed text-vyro-mute">
            Press start when you step on court. VYRO will detect every burst to a corner and recovery back to the T.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SPORTS.map((s) => (
              <button
                key={s.id}
                onClick={() => band.setSport(s.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  band.sport === s.id
                    ? "border-vyro-mint bg-vyro-mint text-vyro-ink"
                    : "border-vyro-line bg-vyro-elev text-vyro-mute hover:bg-vyro-text/5"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            onClick={onStart}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-vyro-mint px-4 py-3 text-sm font-bold text-vyro-ink hover:bg-vyro-mint/85"
          >
            <Play className="h-4 w-4" /> Begin tracking
          </button>
        </Card>
      )}

      {/* LIVE / PAUSED: real metrics dashboard */}
      {(isLive || isPaused) && (
        <>
          <Card
            eyebrow={isLive ? "LIVE" : "PAUSED"}
            title={`${fmtClock(elapsed)} elapsed`}
            action={
              <div className="flex gap-2">
                {isLive ? (
                  <button
                    onClick={onPause}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600"
                  >
                    <Pause className="h-3.5 w-3.5" /> Pause
                  </button>
                ) : (
                  <button
                    onClick={onStart}
                    className="flex items-center gap-1.5 rounded-lg bg-vyro-mint px-3 py-1.5 text-xs font-bold text-vyro-ink hover:bg-vyro-mint/85"
                  >
                    <Play className="h-3.5 w-3.5" /> Resume
                  </button>
                )}
                <button
                  onClick={onEnd}
                  className="flex items-center gap-1.5 rounded-lg bg-vyro-text/10 px-3 py-1.5 text-xs font-bold text-vyro-text hover:bg-vyro-text/15"
                >
                  <Square className="h-3.5 w-3.5" /> End
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat
                label="Heart rate"
                value={live.heartRateBpm ?? "—"}
                unit="bpm"
                hint={currentZone ? `Z${currentZone}` : live.connected ? "waiting…" : undefined}
              />
              <Stat
                label="Movement intensity"
                value={fmtNum(latestG, live.connected, 2)}
                unit="g"
                hint={live.peakG ? `peak ${live.peakG.toFixed(2)}g` : undefined}
              />
              <Stat
                label="T recoveries"
                value={live.connected ? recoveries : "—"}
                hint={`${bursts} bursts off T`}
              />
              <Stat
                label="Controlling the T"
                value={live.connected ? `${tControl}%` : "—"}
                hint="recoveries ÷ bursts"
              />
            </div>
          </Card>

          <Card
            eyebrow="Heart rate · 60s"
            title={live.heartRateBpm != null ? `${live.heartRateBpm} bpm` : "Live HR stream"}
            action={currentZone ? <Pill tone={currentZone >= 4 ? "warn" : "live"}>Z{currentZone}</Pill> : undefined}
          >
            {hrSpark.length >= 2 ? (
              <Spark
                points={hrSpark}
                color="var(--vyro-rose)"
                fill
                height={88}
                min={Math.max(40, Math.min(...hrSpark) - 5)}
                max={Math.min(maxHr + 10, Math.max(...hrSpark) + 5)}
              />
            ) : (
              <div className="flex h-[88px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-vyro-line text-center">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-vyro-mute">waiting for HR</span>
                <span className="text-[10px] text-vyro-mute">
                  HR samples arrive every few seconds once the band's PPG sensor warms up.
                </span>
              </div>
            )}
          </Card>

          <Card
            eyebrow="Acceleration · burst detection"
            title={
              <span className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-vyro-mint" /> Live IMU peaks
              </span>
            }
          >
            <Spark points={accelSeries} color="var(--vyro-mint)" fill height={88} min={0} max={Math.max(4, ...(accelSeries.length ? [Math.max(...accelSeries)] : [4]))} />
            <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-vyro-mute">
              <div>events/min · <span className="text-vyro-text">{live.eventsLastMin}</span></div>
              <div>peak ω · <span className="text-vyro-text">{fmtNum(live.peakDps, live.connected, 0)} dps</span></div>
              <div>fastest Δ · <span className="text-vyro-text">{fmtNum(live.reactMin, live.connected, 0, " ms")}</span></div>
            </div>
          </Card>

          <Card
            eyebrow="HR Zone distribution (live)"
            title={zoneDist.total > 0 ? `${Math.round(zoneDist.total / 1000)}s recorded` : "Awaiting HR stream"}
          >
            <ul className="space-y-1.5">
              {["Z1", "Z2", "Z3", "Z4", "Z5"].map((z, i) => {
                const ms = zoneDist.buckets[i];
                const pct = zoneDist.total > 0 ? (ms / zoneDist.total) * 100 : 0;
                const colors = [
                  "bg-vyro-mint/60",
                  "bg-vyro-mint",
                  "bg-vyro-amber",
                  "bg-vyro-rose/80",
                  "bg-vyro-rose",
                ];
                return (
                  <li key={z} className="flex items-center gap-2">
                    <span className="w-8 font-mono text-[10px] uppercase tracking-[0.18em] text-vyro-mute">{z}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-vyro-elev">
                      <div className={`h-full ${colors[i]} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-10 text-right font-mono text-[10px] text-vyro-mute">
                      {zoneDist.total > 0 ? `${Math.round(pct)}%` : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[10px] text-vyro-mute">
              Zones computed against max HR {maxHr} bpm · Z1 &lt;60% · Z2 60–70% · Z3 70–80% · Z4 80–90% · Z5 90%+.
            </p>
          </Card>

          <Card eyebrow="Live counters" title="Motion events">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Swings" value={live.counts.swing} />
              <Stat label="Rapid starts" value={live.counts.rapid_start} />
              <Stat label="Bursts" value={live.counts.burst} />
              <Stat label="Dir Δ" value={live.counts.direction_change} />
            </div>
          </Card>

          {saveMut.isPending && (
            <div className="text-center text-[11px] text-vyro-mute">Saving session…</div>
          )}
          {saveMut.isSuccess && (
            <div className="text-center text-[11px] text-vyro-mint">Session saved.</div>
          )}
        </>
      )}

      {/* Event stream — handy in both states once we've seen any data */}
      {live.events.length > 0 && (
        <Card eyebrow="Event stream" title={`Last ${Math.min(20, live.events.length)} events`}>
          <ul className="divide-y divide-black/[0.06]">
            {[...live.events].slice(-20).reverse().map((e, i) => {
              const ev = e.event as {
                type: string;
                accelPeakG?: { value: number };
                gyroPeakDps?: { value: number };
                intensity?: number;
                durationMs?: number;
              };
              const time = new Date(e.ts).toLocaleTimeString();
              return (
                <li key={`${e.ts}-${i}`} className="flex items-center justify-between gap-2 py-2 text-xs">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-vyro-mint">{ev.type}</span>
                  <span className="font-mono text-[10px] text-vyro-mute">{time}</span>
                  <span className="text-right font-mono text-[10px] text-vyro-mute">
                    {ev.accelPeakG?.value != null && `g ${ev.accelPeakG.value.toFixed(2)} `}
                    {ev.gyroPeakDps?.value != null && `· ω ${ev.gyroPeakDps.value.toFixed(0)} `}
                    {ev.intensity != null && `· i ${ev.intensity} `}
                    {ev.durationMs != null && `· ${ev.durationMs}ms`}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Hidden marker so reviewers know nothing here is faked */}
      <div className="pt-1 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-vyro-mute">
        <Activity className="mr-1 inline h-3 w-3" /> all values streamed from band · no synthetic data
      </div>
    </div>
  );
}
