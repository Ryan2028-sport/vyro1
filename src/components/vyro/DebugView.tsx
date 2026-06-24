// DebugView — engineering panel for /app2. Surfaces every live metric we
// expose to the rest of the app so it's obvious at a glance which sensor
// channels are flowing and which are still showing "—".
//
// This is intentionally read-only and does not change any logic; it pulls
// from the same `useLiveMetrics` + `useVyroBandCtx` + `useSleepNights`
// stores the other tabs already consume.

import { useMemo } from "react";
import { useLiveMetrics } from "./useLiveMetrics";
import { useVyroBandCtx } from "./VyroBandProvider";
import { useSleepNights } from "@/lib/use-sleep-nights";

type Row = {
  label: string;
  value: string;
  ok: boolean;
  source: string;
  note?: string;
};

function Status({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: 999,
        background: ok ? "#22c55e" : "#6b7280",
        boxShadow: ok ? "0 0 8px rgba(34,197,94,0.6)" : "none",
        marginRight: 8,
      }}
    />
  );
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  const live = rows.filter((r) => r.ok).length;
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: 0.2 }}>{title}</div>
        <div style={{ fontSize: 11, opacity: 0.7 }}>
          {live}/{rows.length} live
        </div>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {rows.map((r) => (
          <div
            key={r.label}
            style={{
              display: "grid",
              gridTemplateColumns: "16px 1fr auto",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              padding: "6px 0",
              borderTop: "1px dashed rgba(255,255,255,0.06)",
            }}
          >
            <Status ok={r.ok} />
            <div>
              <div style={{ fontWeight: 600 }}>{r.label}</div>
              <div style={{ opacity: 0.55, fontSize: 11 }}>
                {r.source}
                {r.note ? ` · ${r.note}` : ""}
              </div>
            </div>
            <div
              style={{
                fontVariantNumeric: "tabular-nums",
                fontWeight: 600,
                color: r.ok ? "#e5f5e9" : "#9ca3af",
              }}
            >
              {r.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const fmt = (v: number | null | undefined, d = 0, u = "") =>
  isNum(v) ? `${v.toFixed(d)}${u}` : "—";

export function DebugView() {
  const m = useLiveMetrics();
  const ctx = useVyroBandCtx();
  const { last: lastSleep, nights } = useSleepNights();

  const connection: Row[] = [
    {
      label: "BLE connected",
      value: m.connected ? "yes" : "no",
      ok: m.connected,
      source: "VyroBandProvider › ble.connectionState",
    },
    {
      label: "Connection state",
      value: ctx.ble.connectionState,
      ok: ctx.ble.connectionState === "connected",
      source: "useBluetooth",
    },
    {
      label: "Paired band",
      value: m.pairedName || m.pairedId || "—",
      ok: !!m.pairedId,
      source: "profile.paired_band_id",
    },
    {
      label: "Connected id",
      value: ctx.ble.connectedId || "—",
      ok: !!ctx.ble.connectedId,
      source: "ble.connectedId",
    },
    {
      label: "Power state",
      value: String(ctx.ble.powerState),
      ok: ctx.ble.powerState === "on",
      source: "ble.powerState",
    },
    {
      label: "Last error",
      value: ctx.ble.error || "—",
      ok: !ctx.ble.error,
      source: "ble.error",
      note: ctx.ble.error ? "see console" : undefined,
    },
  ];

  const health: Row[] = [
    { label: "Heart rate", value: fmt(m.heartRateBpm, 0, " bpm"), ok: isNum(m.heartRateBpm), source: "Goodix GH3026 PPG" },
    { label: "Resting HR", value: fmt(m.restingHrBpm, 0, " bpm"), ok: isNum(m.restingHrBpm), source: "QCBand health frame" },
    { label: "HRV (RMSSD)", value: fmt(m.hrvMs, 0, " ms"), ok: isNum(m.hrvMs), source: "PPG RR-derived" },
    { label: "SpO₂", value: fmt(m.spo2Pct, 0, " %"), ok: isNum(m.spo2Pct), source: "Goodix GH3026" },
    { label: "Skin temp", value: fmt(m.skinTempC, 1, " °C"), ok: isNum(m.skinTempC), source: "Band thermistor" },
    { label: "Respiration", value: fmt(m.respRateBrpm, 0, " brpm"), ok: isNum(m.respRateBrpm), source: "PPG-derived" },
    { label: "Stress", value: fmt(m.stressScore, 0, "/100"), ok: isNum(m.stressScore), source: "QCBand stress packet" },
    {
      label: "Blood pressure",
      value: m.bloodPressure ? `${m.bloodPressure.sbp}/${m.bloodPressure.dbp}` : "—",
      ok: !!m.bloodPressure,
      source: "QCBand BP packet",
    },
    { label: "Battery", value: fmt(m.batteryPct, 0, " %"), ok: isNum(m.batteryPct), source: "Battery service 0x180F" },
  ];

  const activity: Row[] = [
    { label: "Steps today", value: fmt(m.stepsToday, 0), ok: isNum(m.stepsToday), source: "LSM6DSO step counter" },
    { label: "Distance", value: fmt(m.distanceM, 0, " m"), ok: isNum(m.distanceM), source: "QCBand activity packet" },
    { label: "Calories", value: fmt(m.caloriesKcal, 0, " kcal"), ok: isNum(m.caloriesKcal), source: "QCBand activity packet" },
  ];

  const imu: Row[] = [
    { label: "Peak G", value: fmt(m.peakG, 2, " g"), ok: m.peakG > 0, source: "LSM6DSO accel" },
    { label: "Peak gyro", value: fmt(m.peakDps, 0, " dps"), ok: m.peakDps > 0, source: "LSM6DSO gyro" },
    { label: "Peak jerk", value: fmt(m.peakJerk, 0, " g/s"), ok: m.peakJerk > 0, source: "derived" },
    { label: "Swing intensity", value: fmt(m.swingIntMax, 2), ok: m.swingIntMax > 0, source: "swing event" },
    { label: "Swing duration", value: fmt(m.swingDurMax, 0, " ms"), ok: m.swingDurMax > 0, source: "swing event" },
    { label: "Reaction (min)", value: fmt(m.reactMin, 0, " ms"), ok: isNum(m.reactMin), source: "direction_change gap" },
    { label: "Events last 60s", value: String(m.eventsLastMin), ok: m.eventsLastMin > 0, source: "events buffer" },
    { label: "Events total", value: String(m.events.length), ok: m.events.length > 0, source: "session buffer" },
  ];

  const session: Row[] = [
    {
      label: "Session state",
      value: m.sessionState ?? "idle",
      ok: m.sessionState === "live",
      source: "useVyroBand.sessionState",
    },
    {
      label: "Event counts",
      value: m.counts ? Object.entries(m.counts).map(([k, v]) => `${k}:${v}`).join(" ") || "—" : "—",
      ok: !!m.counts && Object.keys(m.counts).length > 0,
      source: "useVyroBand.counts",
    },
  ];

  const sleep: Row[] = useMemo(() => {
    return [
      {
        label: "Sleep frame parser",
        value: "pending firmware spec",
        ok: false,
        source: "use-vyro-band › recordSleepNight",
        note: "opcode/byte layout not yet defined",
      },
      {
        label: "Nights stored",
        value: String(nights.length),
        ok: nights.length > 0,
        source: "localStorage vyro.sleep.nights.v1",
      },
      {
        label: "Last sleep score",
        value: lastSleep ? `${lastSleep.score}/100` : "—",
        ok: !!lastSleep,
        source: "useSleepNights",
      },
      {
        label: "Last asleep min",
        value: lastSleep ? String(lastSleep.asleepMin) : "—",
        ok: !!lastSleep,
        source: "useSleepNights",
      },
    ];
  }, [lastSleep, nights.length]);

  const tabs: Row[] = [
    { label: "Athlete tab", value: "wired", ok: true, source: "AthleteView ← ctx + baselines" },
    { label: "Sport › Overview/CourtDB/Motion", value: "wired", ok: true, source: "SportView ← IMU stream" },
    { label: "Sport › Heat Map / Tendencies", value: "static", ok: false, source: "no live source", note: "demo as requested" },
    { label: "Recovery (all 4 views)", value: "wired", ok: true, source: "RecoveryView ← HR buffer + baselines" },
    { label: "Session", value: "wired", ok: true, source: "SessionView ← ctx" },
    { label: "Sleep", value: lastSleep ? "live" : "awaiting frames", ok: !!lastSleep, source: "SleepView" },
    { label: "Trends", value: "wired to Cloud sessions", ok: true, source: "TrendsView ← getMySessions" },
    { label: "Coach", value: "wired (heuristics)", ok: true, source: "CoachView ← live ctx + baselines" },
  ];

  return (
    <div style={{ padding: 14, color: "#e5e7eb", fontFamily: "Satoshi, system-ui, sans-serif" }}>
      <div
        style={{
          padding: "10px 12px",
          borderRadius: 12,
          background: m.connected ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
          border: `1px solid ${m.connected ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          marginBottom: 12,
          fontSize: 12,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 2 }}>
          {m.connected ? "Band live — streaming" : "Band offline"}
        </div>
        <div style={{ opacity: 0.75 }}>
          A green dot means the metric is currently flowing from the band. Grey means the
          channel exists in the pipeline but has no live value yet (sensor silent, packet
          not parsed, or feature awaiting firmware).
        </div>
      </div>

      <Section title="Connection" rows={connection} />
      <Section title="Vitals (PPG)" rows={health} />
      <Section title="Activity" rows={activity} />
      <Section title="Motion (IMU)" rows={imu} />
      <Section title="Session engine" rows={session} />
      <Section title="Sleep pipeline" rows={sleep} />
      <Section title="Tab wiring" rows={tabs} />
    </div>
  );
}
