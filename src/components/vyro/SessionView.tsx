import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Play, Pause, Square } from "lucide-react";
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
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function SessionView() {
  const band = useVyroBandCtx();
  const live = useLiveMetrics();
  const qc = useQueryClient();
  const save = useServerFn(saveSession);
  const saveMut = useMutation({ mutationFn: save, onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }) });

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const tickRef = useRef<number | null>(null);

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

  async function onStart() {
    setStartedAt(Date.now());
    setNow(Date.now());
    await band.startSession(band.sport);
  }
  async function onPause() {
    await band.pauseSession();
  }
  async function onEnd() {
    const ended = Date.now();
    const started = startedAt ?? ended;
    await band.endSession();
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
            swingIntMax: live.swingIntMax,
            swingIntAvg: live.swingIntAvg,
            swingDurMax: live.swingDurMax,
            swingDurAvg: live.swingDurAvg,
            reactMin: live.reactMin,
            totalEvents: live.events.length,
          },
        },
      });
    } catch (e) {
      console.warn("[vyro] failed to save session", e);
    }
    setStartedAt(null);
  }

  const elapsed = startedAt && band.sessionState !== "idle" ? now - startedAt : 0;

  const recent = [...live.events].slice(-20).reverse();

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Live Console"
        title="Session"
        subtitle="Control your watch, watch events arrive in real time, save the session when done."
        action={<Pill tone={band.sessionState === "live" ? "live" : live.connected ? "warn" : "off"}
                     pulse={band.sessionState === "live"}>
          {band.sessionState === "live" ? "RECORDING" : live.connected ? "READY" : "OFFLINE"}
        </Pill>}
      />

      {!live.connected && (
        <EmptyState
          title="Watch is not connected"
          hint="Pair your band from Profile to control sessions."
        />
      )}

      <Card eyebrow="Session control" title={`${fmtClock(elapsed)} elapsed`}>
        <div className="mb-3 flex flex-wrap gap-2">
          {SPORTS.map((s) => (
            <button
              key={s.id}
              disabled={band.sessionState === "live"}
              onClick={() => band.setSport(s.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                band.sport === s.id
                  ? "border-vyro-mint bg-vyro-mint text-vyro-ink"
                  : "border-vyro-text/10 bg-vyro-panel text-vyro-text/70 hover:bg-vyro-text/5"
              } ${band.sessionState === "live" ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {band.sessionState === "idle" && (
            <button
              onClick={onStart}
              disabled={!live.connected}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-vyro-mint px-4 py-3 text-sm font-bold text-vyro-ink hover:bg-vyro-mint/85 disabled:opacity-50"
            >
              <Play className="h-4 w-4" /> Start
            </button>
          )}
          {band.sessionState === "live" && (
            <>
              <button
                onClick={onPause}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white hover:bg-amber-600"
              >
                <Pause className="h-4 w-4" /> Pause
              </button>
              <button
                onClick={onEnd}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-vyro-mint px-4 py-3 text-sm font-bold text-vyro-ink hover:bg-vyro-text/85"
              >
                <Square className="h-4 w-4" /> End & save
              </button>
            </>
          )}
          {band.sessionState === "paused" && (
            <>
              <button
                onClick={onStart}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-vyro-mint px-4 py-3 text-sm font-bold text-vyro-ink hover:bg-vyro-mint/85"
              >
                <Play className="h-4 w-4" /> Resume
              </button>
              <button
                onClick={onEnd}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-vyro-mint px-4 py-3 text-sm font-bold text-vyro-ink hover:bg-vyro-text/85"
              >
                <Square className="h-4 w-4" /> End & save
              </button>
            </>
          )}
        </div>
        {saveMut.isPending && <div className="mt-2 text-[11px] text-vyro-text/55">Saving session…</div>}
        {saveMut.isSuccess && <div className="mt-2 text-[11px] text-vyro-mint">Session saved.</div>}
      </Card>

      <Card eyebrow="Live counters" title="Motion events">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Swings" value={live.connected ? live.counts.swing : "—"} />
          <Stat label="Rapid starts" value={live.connected ? live.counts.rapid_start : "—"} />
          <Stat label="Bursts" value={live.connected ? live.counts.burst : "—"} />
          <Stat label="Dir Δ" value={live.connected ? live.counts.direction_change : "—"} />
        </div>
      </Card>

      <Card eyebrow="Peaks" title="Highest values seen">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Accel" value={fmtNum(live.peakG, live.connected, 2)} unit="g" />
          <Stat label="Gyro" value={fmtNum(live.peakDps, live.connected, 0)} unit="dps" />
          <Stat label="Jerk" value={fmtNum(live.peakJerk, live.connected, 1)} unit="g/s" />
        </div>
      </Card>

      <Card eyebrow="Event stream" title={`Last ${recent.length} events`}>
        {recent.length === 0 ? (
          <div className="py-6 text-center text-xs text-vyro-text/45">
            {live.connected ? "Waiting for motion events from your band…" : "Connect the band to see events."}
          </div>
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {recent.map((e, i) => {
              const ev = e.event as any;
              const time = new Date(e.ts).toLocaleTimeString();
              return (
                <li key={`${e.ts}-${i}`} className="flex items-center justify-between py-2 text-xs">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-vyro-mint">{ev.type}</span>
                  <span className="font-mono text-[10px] text-vyro-text/45">{time}</span>
                  <span className="text-right font-mono text-[10px] text-vyro-text/65">
                    {ev.accelPeakG?.value != null && `g ${ev.accelPeakG.value.toFixed(2)} `}
                    {ev.gyroPeakDps?.value != null && `· ω ${ev.gyroPeakDps.value.toFixed(0)} `}
                    {ev.intensity != null && `· i ${ev.intensity} `}
                    {ev.durationMs != null && `· ${ev.durationMs}ms`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
