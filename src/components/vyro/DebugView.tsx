// DebugView — engineering panel for /app2.
//
// This screen is the ground-truth view of what the band is actually sending
// over BLE right now. Everything here is read-only and pulls from the live
// `useLiveMetrics` + `useVyroBandCtx` + `useSleepNights` stores the other
// tabs already consume, plus a global BLE inspector that taps into the raw
// despia event bus to count notifications per characteristic and dump the
// last raw payload as hex.
//
// Workflow when a tile elsewhere in the app reads "—":
//   1. Connection section: is `connected = yes` and is `Connected id` the
//      paired band?
//   2. GATT services: did the watch advertise the service the metric needs?
//      If a service is missing, the firmware doesn't expose it — nothing the
//      app can do.
//   3. Per-characteristic notify counts: is the characteristic the metric
//      depends on actually firing? Zero counts after 60s of connection means
//      the watch is silent on that channel.
//   4. Recent notification stream: inspect the last opcode + raw hex to see
//      whether the bytes match the decoder's expected layout.
//   5. Vitals / Activity / IMU sections: shows whether the parsed value made
//      it into app state, with a "last updated" age.

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveMetrics } from "./useLiveMetrics";
import { useVyroBandCtx } from "./VyroBandProvider";
import { useSleepNights } from "@/lib/use-sleep-nights";
import {
  ageLabel,
  shortUuid,
  useBleInspector,
  type CharStat,
  type OpStat,
} from "./use-ble-inspector";

type Row = {
  label: string;
  value: string;
  ok: boolean;
  source: string;
  note?: string;
  ageMs?: number;
};

const FIRMWARE_DIAGNOSTIC_MS = 15 * 60_000;

function durationLabel(ms: number): string {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

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
        flex: "0 0 auto",
      }}
    />
  );
}

function Section({
  title,
  rows,
  rightSlot,
}: {
  title: string;
  rows: Row[];
  rightSlot?: React.ReactNode;
}) {
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
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: 0.2 }}>{title}</div>
        <div style={{ fontSize: 11, opacity: 0.7, display: "flex", alignItems: "center", gap: 8 }}>
          {rightSlot}
          <span>
            {live}/{rows.length} live
          </span>
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
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{r.label}</div>
              <div style={{ opacity: 0.55, fontSize: 11, wordBreak: "break-word" }}>
                {r.source}
                {r.note ? ` · ${r.note}` : ""}
                {r.ageMs != null ? ` · ${ageLabel(r.ageMs)}` : ""}
              </div>
            </div>
            <div
              style={{
                fontVariantNumeric: "tabular-nums",
                fontWeight: 600,
                color: r.ok ? "#e5f5e9" : "#9ca3af",
                whiteSpace: "nowrap",
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

/** Track when each value last changed (became defined or changed) so the
 *  Debug rows can show "updated 4s ago" / "stale 2m ago". */
function useFreshness<T extends Record<string, unknown>>(values: T): Record<keyof T, number | undefined> {
  const lastRef = useRef<Record<string, { v: unknown; t: number }>>({});
  // Use the JSON shape as the dep — values are scalars/small structs.
  const sig = JSON.stringify(values);
  useEffect(() => {
    const now = Date.now();
    for (const k of Object.keys(values)) {
      const v = (values as Record<string, unknown>)[k];
      if (v == null) continue;
      const prev = lastRef.current[k];
      if (!prev || JSON.stringify(prev.v) !== JSON.stringify(v)) {
        lastRef.current[k] = { v, t: now };
      }
    }
  }, [sig]);

  // Cause periodic re-render so age labels tick.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const out: Record<string, number | undefined> = {};
  const now = Date.now();
  for (const k of Object.keys(values)) {
    const e = lastRef.current[k];
    out[k] = e ? now - e.t : undefined;
  }
  return out as Record<keyof T, number | undefined>;
}

export function DebugView() {
  const m = useLiveMetrics();
  const ctx = useVyroBandCtx();
  const { last: lastSleep, nights } = useSleepNights();
  const inspector = useBleInspector();
  const diagnosticStartRef = useRef(Date.now());
  const diagnosticBaselineRef = useRef<{
    totalNotifications: number;
    writes: { total: number; ok: number; failed: number };
    opcodes: Record<string, number>;
  } | null>(null);
  const [diagnosticRun, setDiagnosticRun] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const snapshotDiagnosticBaseline = () => ({
    totalNotifications: inspector.totalNotifications,
    writes: {
      total: inspector.writes.total,
      ok: inspector.writes.ok,
      failed: inspector.writes.failed,
    },
    opcodes: Object.fromEntries(
      Object.entries(inspector.perOpcode).map(([key, stat]) => [key, stat.count]),
    ),
  });
  if (!diagnosticBaselineRef.current) diagnosticBaselineRef.current = snapshotDiagnosticBaseline();
  const restartFirmwareDiagnostic = () => {
    diagnosticStartRef.current = Date.now();
    diagnosticBaselineRef.current = snapshotDiagnosticBaseline();
    setDiagnosticRun((run) => run + 1);
  };
  const signalAge = (at: number | null | undefined) => (at ? now - at : undefined);
  const hardwareSeen = (value: unknown, at?: number | null) =>
    m.connected && value != null && (at == null || now - at < 30 * 60_000);

  const fresh = useFreshness({
    heartRateBpm: ctx.heartRateBpm,
    restingHrBpm: ctx.restingHrBpm,
    hrvMs: ctx.hrvMs,
    spo2Pct: ctx.spo2Pct,
    skinTempC: ctx.skinTempC,
    respRateBrpm: ctx.respRateBrpm,
    stressScore: ctx.stressScore,
    bloodPressure: ctx.bloodPressure,
    batteryPct: ctx.batteryPct,
    stepsToday: ctx.stepsToday,
    distanceM: ctx.distanceM,
    caloriesKcal: ctx.caloriesKcal,
    peakG: m.peakG > 0 ? m.peakG : null,
    peakDps: m.peakDps > 0 ? m.peakDps : null,
    peakJerk: m.peakJerk > 0 ? m.peakJerk : null,
    eventsLastMin: m.eventsLastMin,
    sessionState: m.sessionState,
  });

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
      label: "Notifications received",
      value: String(inspector.totalNotifications),
      ok: inspector.totalNotifications > 0,
      source: "ble.on('data') tap",
    },
    {
      label: "GATT services discovered",
      value: String(inspector.discovered?.services.length ?? 0),
      ok: !!inspector.discovered && inspector.discovered.services.length > 0,
      source: "ble.on('discovered')",
    },
    {
      label: "Last error",
      value: ctx.ble.error || "—",
      ok: !ctx.ble.error,
      source: "ble.error",
    },
  ];

  const health: Row[] = [
    { label: "Heart rate", value: fmt(ctx.heartRateBpm, 0, " bpm"), ok: hardwareSeen(ctx.heartRateBpm, ctx.heartRateAt), source: "Goodix PPG · realtime HR / measure frame", ageMs: signalAge(ctx.heartRateAt) },
    { label: "Resting HR", value: fmt(ctx.restingHrBpm, 0, " bpm"), ok: hardwareSeen(ctx.restingHrBpm, ctx.signalAt.restingHrAt), source: "5-min live HR buffer · 5th percentile", ageMs: signalAge(ctx.signalAt.restingHrAt) },
    { label: "HRV (RMSSD)", value: fmt(ctx.hrvMs, 0, " ms"), ok: hardwareSeen(ctx.hrvMs, ctx.signalAt.hrvAt), source: "QCBand hardware · 0x39 history / 0x69 measure", ageMs: signalAge(ctx.signalAt.hrvAt) },
    { label: "SpO₂", value: fmt(ctx.spo2Pct, 0, " %"), ok: hardwareSeen(ctx.spo2Pct, ctx.signalAt.spo2At), source: "QCBand hardware · 0x69 / V2 0xbc / notify", ageMs: signalAge(ctx.signalAt.spo2At) },
    { label: "Skin temp", value: fmt(ctx.skinTempC, 1, " °C"), ok: hardwareSeen(ctx.skinTempC, ctx.signalAt.skinTempAt), source: "QCBand hardware · 0x69 / V2 0xbc / notify", ageMs: signalAge(ctx.signalAt.skinTempAt) },
    { label: "Respiration", value: fmt(ctx.respRateBrpm, 1, " brpm"), ok: isNum(ctx.respRateBrpm), source: "Awaiting real resp-rate field from firmware", ageMs: fresh.respRateBrpm },
    { label: "Stress", value: fmt(ctx.stressScore, 0, "/100"), ok: hardwareSeen(ctx.stressScore, ctx.signalAt.stressAt), source: "QCBand hardware · 0x37 history / 0x69 measure", ageMs: signalAge(ctx.signalAt.stressAt) },
    {
      label: "Blood pressure",
      value: ctx.bloodPressure ? `${ctx.bloodPressure.sbp}/${ctx.bloodPressure.dbp}` : "—",
      ok: hardwareSeen(ctx.bloodPressure, ctx.signalAt.bloodPressureAt),
      source: "QCBand 0x69(0x05) one-key payload",
      ageMs: signalAge(ctx.signalAt.bloodPressureAt),
    },
    { label: "Battery", value: fmt(ctx.batteryPct, 0, " %"), ok: hardwareSeen(ctx.batteryPct, ctx.signalAt.batteryAt), source: "GATT 0x2A19 · QCBand 0x03", ageMs: signalAge(ctx.signalAt.batteryAt) },
  ];

  const activity: Row[] = [
    { label: "Steps today", value: fmt(ctx.stepsToday, 0), ok: hardwareSeen(ctx.stepsToday, ctx.signalAt.stepsAt), source: "QCBand summary / live / history packet", ageMs: signalAge(ctx.signalAt.stepsAt) },
    { label: "Distance", value: fmt(ctx.distanceM, 0, " m"), ok: hardwareSeen(ctx.distanceM, ctx.signalAt.distanceAt), source: "QCBand activity payload", ageMs: signalAge(ctx.signalAt.distanceAt) },
    { label: "Calories", value: fmt(ctx.caloriesKcal, 0, " kcal"), ok: hardwareSeen(ctx.caloriesKcal, ctx.signalAt.caloriesAt), source: "QCBand activity payload", ageMs: signalAge(ctx.signalAt.caloriesAt) },
  ];

  const imu: Row[] = [
    { label: "Peak G", value: fmt(m.peakG, 2, " g"), ok: m.peakG > 0, source: "VYRO motion · 0x10/0x11/0x12", ageMs: fresh.peakG },
    { label: "Peak gyro", value: fmt(m.peakDps, 0, " dps"), ok: m.peakDps > 0, source: "VYRO motion · gyroPeakDps", ageMs: fresh.peakDps },
    { label: "Peak jerk", value: fmt(m.peakJerk, 0, " g/s"), ok: m.peakJerk > 0, source: "VYRO motion · jerkPeakGps", ageMs: fresh.peakJerk },
    { label: "Swing intensity (max)", value: fmt(m.swingIntMax, 2), ok: m.swingIntMax > 0, source: "VYRO motion · swing.intensity" },
    { label: "Swing duration (max)", value: fmt(m.swingDurMax, 0, " ms"), ok: m.swingDurMax > 0, source: "VYRO motion · swing.durationMs" },
    { label: "Reaction (min)", value: fmt(m.reactMin, 0, " ms"), ok: isNum(m.reactMin), source: "VYRO motion · direction_change.gapMs" },
    { label: "Events last 60s", value: String(m.eventsLastMin), ok: m.eventsLastMin > 0, source: "in-memory event buffer", ageMs: fresh.eventsLastMin },
    { label: "Events total (buffered)", value: String(m.events.length), ok: m.events.length > 0, source: "last 120 events" },
  ];

  const session: Row[] = [
    {
      label: "Session state",
      value: m.sessionState ?? "idle",
      ok: m.sessionState === "live",
      source: "useVyroBand.sessionState",
      ageMs: fresh.sessionState,
    },
    {
      label: "Event counts",
      value: m.counts
        ? Object.entries(m.counts).map(([k, v]) => `${k}:${v}`).join(" ") || "—"
        : "—",
      ok: !!m.counts && Object.keys(m.counts).length > 0,
      source: "useVyroBand.counts",
    },
  ];

  const sleep: Row[] = useMemo(
    () => [
      {
        label: "Sleep frame parser",
        value: "pending firmware spec",
        ok: false,
        source: "use-vyro-band › recordSleepNight",
        note: "QCBand 0x32 layout not yet finalised",
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
    ],
    [lastSleep, nights.length],
  );

  const tabs: Row[] = [
    { label: "Athlete tab", value: "wired", ok: true, source: "AthleteView ← ctx + baselines" },
    { label: "Sport › Overview / CourtDB / Motion", value: "wired", ok: true, source: "SportView ← IMU stream" },
    { label: "Sport › Heat Map / Tendencies", value: "static", ok: false, source: "no live source (intentional)" },
    { label: "Recovery (all 4 views)", value: "wired", ok: true, source: "RecoveryView ← HR buffer + baselines" },
    { label: "Session", value: "wired", ok: true, source: "SessionView ← ctx" },
    { label: "Sleep", value: lastSleep ? "live" : "awaiting frames", ok: !!lastSleep, source: "SleepView" },
    { label: "Trends", value: "wired to Cloud sessions", ok: true, source: "TrendsView ← getMySessions" },
    { label: "Coach", value: "wired (heuristics)", ok: true, source: "CoachView ← live ctx + baselines" },
  ];

  const firmwareDiagnosticRows: Row[] = useMemo(() => {
    const baseline = diagnosticBaselineRef.current ?? snapshotDiagnosticBaseline();
    const opDelta = (code: number) => {
      const key = `0x${code.toString(16).padStart(2, "0")}`;
      return Math.max(0, (inspector.perOpcode[key]?.count ?? 0) - (baseline.opcodes[key] ?? 0));
    };
    const opAge = (code: number) => {
      const key = `0x${code.toString(16).padStart(2, "0")}`;
      const at = inspector.perOpcode[key]?.lastAt;
      return at ? now - at : undefined;
    };
    const notifDelta = Math.max(0, inspector.totalNotifications - baseline.totalNotifications);
    const writeTotalDelta = Math.max(0, inspector.writes.total - baseline.writes.total);
    const writeOkDelta = Math.max(0, inspector.writes.ok - baseline.writes.ok);
    const writeFailDelta = Math.max(0, inspector.writes.failed - baseline.writes.failed);
    const stepsDelta = opDelta(0x09) + opDelta(0x07) + opDelta(0x43) + opDelta(0x48);
    const measureDelta = opDelta(0x69) + opDelta(0x6a);
    return [
      {
        label: "Capture duration",
        value: durationLabel(now - diagnosticStartRef.current),
        ok: now - diagnosticStartRef.current >= FIRMWARE_DIAGNOSTIC_MS,
        source: "15-minute firmware diagnostic window",
        note: now - diagnosticStartRef.current >= FIRMWARE_DIAGNOSTIC_MS ? "minimum complete; still recording" : `${durationLabel(FIRMWARE_DIAGNOSTIC_MS - (now - diagnosticStartRef.current))} remaining`,
      },
      {
        label: "Notifications captured",
        value: String(notifDelta),
        ok: notifDelta > 0,
        source: "raw BLE data events since diagnostic start",
      },
      {
        label: "Writes acknowledged",
        value: `${writeOkDelta}/${writeTotalDelta}`,
        ok: writeTotalDelta > 0 && writeFailDelta === 0,
        source: "firmware command writes since diagnostic start",
        note: writeFailDelta > 0 ? `${writeFailDelta} failed` : undefined,
        ageMs: inspector.writes.lastAt ? now - inspector.writes.lastAt : undefined,
      },
      {
        label: "Heart-rate firmware path",
        value: String(opDelta(0x1e)),
        ok: opDelta(0x1e) > 0,
        source: "opcode 0x1e realtime HR",
        ageMs: opAge(0x1e),
      },
      {
        label: "Activity firmware path",
        value: String(stepsDelta),
        ok: stepsDelta > 0,
        source: "opcodes 0x09 / 0x07 / 0x43 / 0x48",
        ageMs: Math.min(opAge(0x09) ?? Infinity, opAge(0x07) ?? Infinity, opAge(0x43) ?? Infinity, opAge(0x48) ?? Infinity),
      },
      {
        label: "Optical measure path",
        value: String(measureDelta),
        ok: measureDelta > 0,
        source: "opcodes 0x69 / 0x6a for SpO₂, temp, HRV, stress",
        ageMs: Math.min(opAge(0x69) ?? Infinity, opAge(0x6a) ?? Infinity),
      },
      {
        label: "HRV history path",
        value: String(opDelta(0x39)),
        ok: opDelta(0x39) > 0,
        source: "opcode 0x39 today HRV/RMSSD history",
        ageMs: opAge(0x39),
      },
      {
        label: "Stress history path",
        value: String(opDelta(0x37)),
        ok: opDelta(0x37) > 0,
        source: "opcode 0x37 today stress history",
        ageMs: opAge(0x37),
      },
      {
        label: "Live notification path",
        value: String(opDelta(0x73)),
        ok: opDelta(0x73) > 0,
        source: "opcode 0x73 live activity / SpO₂ / temp notify",
        ageMs: opAge(0x73),
      },
      {
        label: "V2 history path",
        value: String(opDelta(0xbc)),
        ok: opDelta(0xbc) > 0,
        source: "opcode 0xbc big-data SpO₂ / temperature history",
        note: "only expected if the V2 service is advertised",
        ageMs: opAge(0xbc),
      },
    ];
  }, [diagnosticRun, inspector, now]);

  // Per-characteristic counter table.
  const charStats: CharStat[] = useMemo(
    () =>
      Object.values(inspector.perChar).sort(
        (a, b) => b.lastAt - a.lastAt,
      ),
    [inspector.perChar],
  );

  const opcodeStats: OpStat[] = useMemo(
    () => Object.values(inspector.perOpcode).sort((a, b) => b.lastAt - a.lastAt),
    [inspector.perOpcode],
  );

  const expectedTraffic: Row[] = useMemo(() => {
    const op = (code: number) => inspector.perOpcode[`0x${code.toString(16).padStart(2, "0")}`];
    const mk = (label: string, code: number, source: string, note?: string): Row => {
      const stat = op(code);
      return {
        label,
        value: stat ? String(stat.count) : "0",
        ok: !!stat,
        source,
        note: stat ? `last ${stat.lastHex}` : note,
        ageMs: stat ? now - stat.lastAt : undefined,
      };
    };
    return [
      mk("Realtime HR frames", 0x1e, "QCBand opcode 0x1e", "HR works if this increments"),
      mk("Battery replies", 0x03, "QCBand opcode 0x03", "sent every 60s"),
      mk("Steps / summary replies", 0x09, "QCBand opcode 0x09", "also check opcode 0x07 / 0x43 below"),
      mk("Steps alt replies", 0x07, "QCBand opcode 0x07", "older daily total"),
      mk("Activity history", 0x43, "QCBand opcode 0x43", "hourly activity sync"),
      mk("Measurement frames", 0x69, "QCBand opcode 0x69", "SpO₂/temp/HRV/stress one-key/manual"),
      mk("Measurement stop/echo", 0x6a, "QCBand opcode 0x6a", "some firmwares answer on stop"),
      mk("Stress history", 0x37, "QCBand opcode 0x37", "30-min stress sync"),
      mk("HRV history", 0x39, "QCBand opcode 0x39", "30-min HRV sync"),
      mk("Live notifications", 0x73, "QCBand opcode 0x73", "activity / SpO₂ / temp notify"),
      mk("V2 big-data", 0xbc, "QCBand V2 opcode 0xbc", "SpO₂/temp history service"),
    ];
  }, [inspector.perOpcode, now]);

  // GATT tree — group by service.
  const gattRows = useMemo(() => {
    const services = inspector.discovered?.services ?? [];
    return services.map((svc) => ({
      uuid: svc.uuid,
      short: shortUuid(svc.uuid),
      chars: svc.characteristics.map((c) => ({
        uuid: c.uuid,
        short: shortUuid(c.uuid),
        props: c.properties.join(","),
      })),
    }));
  }, [inspector.discovered]);

  // Per-metric pipeline derived from existing data:
  //   cmd written → notif received (opcode) → value stored (signalAt timestamp).
  // A grey stage tells you exactly where in the chain a tile is dying.
  const pipelineRows = useMemo(() => {
    const op = (code: number) =>
      inspector.perOpcode[`0x${code.toString(16).padStart(2, "0")}`];
    const writeForOp = (codes: number[]) =>
      inspector.writeLog.find((w) => w.opcode != null && codes.includes(w.opcode));
    const sumOp = (codes: number[]) =>
      codes.reduce((acc, c) => acc + (op(c)?.count ?? 0), 0);
    const lastOp = (codes: number[]) => {
      let t = 0;
      for (const c of codes) {
        const at = op(c)?.lastAt ?? 0;
        if (at > t) t = at;
      }
      return t || null;
    };
    type P = {
      metric: string;
      // pushOnly = firmware streams this without us asking; do not require a
      // matching cmd in the pipeline check.
      pushOnly?: boolean;
      cmdOps: number[];
      notifOps: number[];
      storedAt: number | null | undefined;
      value: string;
    };
    const rows: P[] = [
      { metric: "Heart rate",     cmdOps: [0x1e],              notifOps: [0x1e],                    storedAt: ctx.heartRateAt,             value: fmt(ctx.heartRateBpm, 0, " bpm") },
      // SpO₂/temp/HRV/stress/BP arrive INSIDE 0x69 composite frames that the
      // watch pushes on its own cadence — no explicit cmd is required.
      { metric: "SpO₂",           pushOnly: true,  cmdOps: [],  notifOps: [0x69, 0x73, 0xbc],       storedAt: ctx.signalAt.spo2At,         value: fmt(ctx.spo2Pct, 0, " %") },
      { metric: "Skin temp",      pushOnly: true,  cmdOps: [],  notifOps: [0x69, 0x73, 0xbc, 0x87], storedAt: ctx.signalAt.skinTempAt,     value: fmt(ctx.skinTempC, 1, " °C") },
      { metric: "HRV",            pushOnly: true,  cmdOps: [],  notifOps: [0x39, 0x69],             storedAt: ctx.signalAt.hrvAt,          value: fmt(ctx.hrvMs, 0, " ms") },
      { metric: "Stress",         pushOnly: true,  cmdOps: [],  notifOps: [0x37, 0x69],             storedAt: ctx.signalAt.stressAt,       value: fmt(ctx.stressScore, 0) },
      { metric: "Blood pressure", pushOnly: true,  cmdOps: [],  notifOps: [0x69, 0x89],             storedAt: ctx.signalAt.bloodPressureAt, value: ctx.bloodPressure ? `${ctx.bloodPressure.sbp}/${ctx.bloodPressure.dbp}` : "—" },
      { metric: "Steps",          cmdOps: [0x09, 0x07, 0x43, 0x48], notifOps: [0x09, 0x07, 0x43, 0x48, 0x73], storedAt: ctx.signalAt.stepsAt, value: fmt(ctx.stepsToday, 0) },
      // Battery on this firmware: response often piggybacks the 0x09 today-
      // summary path even though encodeQcBandBatteryRequest writes 0x03.
      { metric: "Battery",        cmdOps: [0x03, 0x09],        notifOps: [0x03, 0x09],              storedAt: ctx.signalAt.batteryAt,      value: fmt(ctx.batteryPct, 0, " %") },
      { metric: "Motion (IMU)",   pushOnly: true,  cmdOps: [], notifOps: [0x69, 0x73, 0x87, 0x89],  storedAt: m.peakG > 0 ? now : null,    value: m.peakG > 0 ? fmt(m.peakG, 2, " g (derived)") : "—" },
      { metric: "Sleep",          cmdOps: [0x32],              notifOps: [0x32],                    storedAt: lastSleep ? Date.now() : null, value: lastSleep ? `${lastSleep.score}/100` : "—" },
    ];
    const FRESH_MS = 60_000;
    return rows.map((r) => {
      const cmd = writeForOp(r.cmdOps);
      const notifCount = sumOp(r.notifOps);
      const notifAt = lastOp(r.notifOps);
      const stored = r.storedAt != null;
      const fresh = stored && now - (r.storedAt ?? 0) < FRESH_MS;
      const stages = [
        r.pushOnly ? "push-only" : cmd ? "cmd ✓" : "cmd ✗",
        notifCount > 0 ? `notif ✓ ×${notifCount}` : "notif ✗",
        fresh ? "live ✓" : stored ? "stale ⚠" : "no data ✗",
      ];
      // Honest pass criteria: a live value in the last 60s. For cmd-driven
      // metrics, also require we actually wrote the command.
      const stageOk = fresh && (r.pushOnly || !!cmd);
      let note: string;
      if (fresh) note = `live ${ageLabel(now - (r.storedAt ?? 0))}`;
      else if (stored) note = `last value ${ageLabel(now - (r.storedAt ?? 0))} — watch silent`;
      else if (notifCount > 0) note = "frames arrive but decoder gets no value (firmware empty payload)";
      else if (r.pushOnly) note = "watch firmware never pushes this opcode";
      else if (!cmd) note = "command never sent";
      else note = "cmd sent, no notification reply";
      return {
        label: r.metric,
        value: r.value,
        ok: stageOk,
        source: stages.join(" → "),
        note,
        ageMs: r.storedAt != null ? signalAge(r.storedAt) : undefined,
      } as Row;
    });
  }, [ctx, m, lastSleep, inspector.perOpcode, inspector.writeLog, now]);

  // Firmware-capability report — for each notify opcode we've seen, classify
  // what the watch is actually telling us based on its status byte. Catches
  // the "watch sends 0x87/0x89 but byte[1]=0xee = unsupported" case.
  const capabilityRows: Row[] = useMemo(() => {
    const entries = Object.entries(inspector.perOpcode);
    if (entries.length === 0) {
      return [{ label: "No frames received yet", value: "—", ok: false, source: "connect the watch and wait ~10s" }];
    }
    const interpret = (opHex: string, lastHex: string): { verdict: string; ok: boolean } => {
      const code = parseInt(opHex, 16);
      const bytes = lastHex.split(" ").map((b) => parseInt(b, 16));
      const b1 = bytes[1] ?? 0;
      if (code === 0x1e) return { verdict: `HR scalar — bpm=${b1}`, ok: b1 > 30 && b1 < 220 };
      if (code === 0x69) {
        const sub = b1;
        const hr = bytes[3] ?? 0;
        const spo2 = bytes[5] ?? 0;
        return { verdict: `composite sub=0x${sub.toString(16)} → hr=${hr} spo2=${spo2} (no temp/HRV/BP bytes)`, ok: hr > 0 || spo2 > 0 };
      }
      if (code === 0x43) return { verdict: b1 === 0xff ? "watch reports NO activity history (0xff)" : `activity sub=0x${b1.toString(16)}`, ok: b1 !== 0xff };
      if (code === 0x48) return { verdict: b1 === 0 && (bytes[2] ?? 0) === 0 ? "today-sports all-zero (watch hasn't logged steps today)" : "today-sports payload present", ok: b1 !== 0 || (bytes[2] ?? 0) !== 0 };
      if (code === 0x87 || code === 0x89) {
        if (b1 === 0xee) return { verdict: "status 0xee = keep-alive / feature unsupported on this firmware", ok: false };
        return { verdict: `payload b1=0x${b1.toString(16)} — investigate`, ok: true };
      }
      if (code === 0x03) return { verdict: `battery level=${b1}%`, ok: b1 > 0 };
      if (code === 0x37) return { verdict: `stress history bucket=${b1}`, ok: b1 > 0 };
      if (code === 0x39) return { verdict: `HRV history bucket=${b1}`, ok: b1 > 0 };
      return { verdict: `unknown opcode payload b1=0x${b1.toString(16)}`, ok: false };
    };
    return entries
      .sort((a, b) => (b[1].count - a[1].count))
      .map(([opHex, stat]) => {
        const v = interpret(opHex, stat.lastHex);
        return {
          label: `${opHex} ×${stat.count}`,
          value: v.verdict,
          ok: v.ok,
          source: stat.lastHex,
          ageMs: now - stat.lastAt,
        } as Row;
      });
  }, [inspector.perOpcode, now]);

  const decoderRows: Row[] = useMemo(() => {
    const total = inspector.decoderKnownCount + inspector.decoderUnknownCount;
    const unknownEntries = Object.entries(inspector.unknownOpcodes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([k, v]) => `${k}×${v}`)
      .join(" ");
    return [
      {
        label: "Frames recognised by decoder",
        value: `${inspector.decoderKnownCount}/${total || 0}`,
        ok: inspector.decoderKnownCount > 0,
        source: "opcode in QCBand known-opcode set",
      },
      {
        label: "Frames silently ignored",
        value: String(inspector.decoderUnknownCount),
        ok: inspector.decoderUnknownCount === 0,
        source: "opcode not in known-opcode set",
        note: unknownEntries || undefined,
      },
    ];
  }, [inspector.decoderKnownCount, inspector.decoderUnknownCount, inspector.unknownOpcodes]);

  const buildDebugBundle = () => ({
    capturedAt: new Date().toISOString(),
    connected: m.connected,
    pairedId: m.pairedId,
    connectedId: ctx.ble.connectedId,
    powerState: ctx.ble.powerState,
    lastError: ctx.ble.error || null,
    totalNotifications: inspector.totalNotifications,
    writes: inspector.writes,
    decoder: {
      known: inspector.decoderKnownCount,
      unknown: inspector.decoderUnknownCount,
      unknownOpcodes: inspector.unknownOpcodes,
    },
    perOpcode: Object.fromEntries(
      Object.entries(inspector.perOpcode).map(([k, v]) => [k, { count: v.count, lastAt: v.lastAt, lastHex: v.lastHex }]),
    ),
    perChar: Object.fromEntries(
      Object.entries(inspector.perChar).map(([k, v]) => [k, { count: v.count, lastAt: v.lastAt, lastOpcode: v.lastOpcode, lastHex: v.lastHex }]),
    ),
    pipeline: pipelineRows.map((r) => ({ metric: r.label, value: r.value, ok: r.ok, stages: r.source, note: r.note })),
    recentNotifications: inspector.recent,
    writeLog: inspector.writeLog,
    gatt: inspector.discovered?.services.map((s) => ({
      service: s.uuid,
      characteristics: s.characteristics.map((c) => ({ uuid: c.uuid, properties: c.properties })),
    })) ?? [],
    ctx: {
      heartRateBpm: ctx.heartRateBpm,
      spo2Pct: ctx.spo2Pct,
      skinTempC: ctx.skinTempC,
      hrvMs: ctx.hrvMs,
      stressScore: ctx.stressScore,
      bloodPressure: ctx.bloodPressure,
      stepsToday: ctx.stepsToday,
      caloriesKcal: ctx.caloriesKcal,
      distanceM: ctx.distanceM,
      batteryPct: ctx.batteryPct,
    },
    motion: { peakG: m.peakG, peakDps: m.peakDps, peakJerk: m.peakJerk, eventsLastMin: m.eventsLastMin, sessionState: m.sessionState },
  });

  const [bundleCopied, setBundleCopied] = useState<string | null>(null);
  const copyBundle = async () => {
    const json = JSON.stringify(buildDebugBundle(), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setBundleCopied("Copied to clipboard");
    } catch {
      // Fallback: open a textarea selection
      try {
        const ta = document.createElement("textarea");
        ta.value = json;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setBundleCopied("Copied to clipboard");
      } catch {
        setBundleCopied("Copy failed — see console");
        // eslint-disable-next-line no-console
        console.log("[debug-bundle]", json);
      }
    }
    window.setTimeout(() => setBundleCopied(null), 2500);
  };

  return (
    <div style={{ padding: 14, color: "#e5e7eb", fontFamily: "Satoshi, system-ui, sans-serif" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          {bundleCopied || "Paste the bundle into chat for a one-shot diagnosis."}
        </div>
        <button
          type="button"
          onClick={copyBundle}
          style={{
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 10,
            padding: "6px 12px",
            background: "rgba(59,130,246,0.18)",
            color: "inherit",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Copy debug bundle
        </button>
      </div>
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
          Green dot = metric flowing right now. Grey = silent. If a metric stays
          grey while the band is connected, check (1) the GATT services list — is
          the characteristic even advertised? (2) the per-characteristic notify
          count — is it incrementing? (3) the raw bytes — do they match the
          decoder. Every value below is real or empty, never demo.
        </div>
      </div>

      <Section title="Connection" rows={connection} />
      <Section
        title="Firmware diagnostic recorder"
        rows={firmwareDiagnosticRows}
        rightSlot={
          <button
            type="button"
            onClick={restartFirmwareDiagnostic}
            style={{
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 8,
              padding: "4px 8px",
              background: "rgba(255,255,255,0.06)",
              color: "inherit",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Restart 15m
          </button>
        }
      />
      <Section title="Per-metric pipeline (cmd → notif → stored)" rows={pipelineRows} />
      <Section title="Decoder outcomes" rows={decoderRows} />
      <Section title="Vitals (PPG)" rows={health} />
      <Section title="Activity" rows={activity} />
      <Section title="Motion (IMU)" rows={imu} />
      <Section title="Session engine" rows={session} />
      <Section title="Sleep pipeline" rows={sleep} />
      <Section title="Tab wiring" rows={tabs} />
      <Section
        title="Expected BLE traffic by metric"
        rows={expectedTraffic}
        rightSlot={
          <span>
            writes {inspector.writes.ok}/{inspector.writes.total}
            {inspector.writes.lastAt ? ` · ${ageLabel(now - inspector.writes.lastAt)}` : ""}
          </span>
        }
      />

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14,
          padding: 14,
          marginBottom: 12,
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
          GATT services discovered
        </div>
        {gattRows.length === 0 ? (
          <div style={{ opacity: 0.6, fontSize: 12 }}>
            No service tree yet — the bridge hasn’t emitted a `discovered` event.
            On iOS this is normal until the watch finishes pairing.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {gattRows.map((svc) => (
              <div
                key={svc.uuid}
                style={{
                  borderTop: "1px dashed rgba(255,255,255,0.06)",
                  paddingTop: 6,
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 12 }}>
                  Service <span style={{ opacity: 0.85 }}>{svc.short}</span>
                </div>
                <div style={{ opacity: 0.45, fontSize: 10, wordBreak: "break-all" }}>
                  {svc.uuid}
                </div>
                <div style={{ display: "grid", gap: 2, marginTop: 4, paddingLeft: 8 }}>
                  {svc.chars.map((c) => (
                    <div
                      key={c.uuid}
                      style={{
                        fontSize: 11,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span style={{ opacity: 0.8 }}>↳ {c.short}</span>
                      <span style={{ opacity: 0.5 }}>{c.props || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
            marginBottom: 8,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14 }}>Opcode counters</div>
          <div style={{ opacity: 0.6, fontSize: 11 }}>
            {opcodeStats.length} opcodes seen
          </div>
        </div>
        {opcodeStats.length === 0 ? (
          <div style={{ opacity: 0.6, fontSize: 12 }}>
            No decodable opcodes yet.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {opcodeStats.map((s) => {
              const age = now - s.lastAt;
              const fresh = age < 10_000;
              return (
                <div
                  key={s.opcode}
                  style={{
                    borderTop: "1px dashed rgba(255,255,255,0.06)",
                    paddingTop: 6,
                    fontSize: 11,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Status ok={fresh} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>
                        0x{s.opcode.toString(16).padStart(2, "0")}
                      </div>
                      <div style={{ opacity: 0.55, fontSize: 10 }}>
                        {shortUuid(s.characteristic)} · {ageLabel(age)}
                      </div>
                    </div>
                    <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                      {s.count}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 10,
                      opacity: 0.7,
                      marginTop: 3,
                      wordBreak: "break-all",
                    }}
                  >
                    {s.lastHex || "—"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
            marginBottom: 8,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14 }}>Per-characteristic notify counters</div>
          <div style={{ opacity: 0.6, fontSize: 11 }}>
            {charStats.length} channels active
          </div>
        </div>
        {charStats.length === 0 ? (
          <div style={{ opacity: 0.6, fontSize: 12 }}>
            No notifications received yet. If this stays empty for &gt;30s after
            connect, the band is silent on every subscribed characteristic.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {charStats.map((s) => {
              const key = `${s.service}::${s.characteristic}`;
              const age = now - s.lastAt;
              const fresh = age < 5000;
              return (
                <div
                  key={key}
                  style={{
                    borderTop: "1px dashed rgba(255,255,255,0.06)",
                    paddingTop: 6,
                    fontSize: 11,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Status ok={fresh} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>
                        {shortUuid(s.service)} → {shortUuid(s.characteristic)}
                      </div>
                      <div style={{ opacity: 0.55, fontSize: 10 }}>
                        op 0x{(s.lastOpcode ?? 0).toString(16).padStart(2, "0")} ·{" "}
                        {ageLabel(age)}
                      </div>
                    </div>
                    <div
                      style={{
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 700,
                      }}
                    >
                      {s.count}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 10,
                      opacity: 0.7,
                      marginTop: 3,
                      wordBreak: "break-all",
                    }}
                  >
                    {s.lastHex || "—"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14,
          padding: 14,
          marginBottom: 12,
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
          Recent notification stream
        </div>
        {inspector.recent.length === 0 ? (
          <div style={{ opacity: 0.6, fontSize: 12 }}>No traffic yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 4 }}>
            {inspector.recent.map((r, i) => (
              <div
                key={`${r.ts}-${i}`}
                style={{
                  fontSize: 10,
                  fontFamily: "ui-monospace, monospace",
                  borderTop: "1px dashed rgba(255,255,255,0.05)",
                  paddingTop: 4,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ opacity: 0.7 }}>
                    {ageLabel(now - r.ts)} · {shortUuid(r.characteristic)}
                    {r.opcode != null
                      ? ` · 0x${r.opcode.toString(16).padStart(2, "0")}`
                      : ""}
                  </span>
                </div>
                <div style={{ opacity: 0.85, wordBreak: "break-all" }}>{r.hex || "—"}</div>
              </div>
            ))}
          </div>
        )}
      </div>

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
            marginBottom: 8,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14 }}>Recent write log</div>
          <div style={{ opacity: 0.6, fontSize: 11 }}>
            {inspector.writes.ok}/{inspector.writes.total} ok
          </div>
        </div>
        {inspector.writeLog.length === 0 ? (
          <div style={{ opacity: 0.6, fontSize: 12 }}>
            No commands sent yet. If this stays empty after connect, the app
            never issued a measurement command — the band has nothing to reply to.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 4 }}>
            {inspector.writeLog.map((w, i) => (
              <div
                key={`${w.ts}-${i}`}
                style={{
                  fontSize: 10,
                  fontFamily: "ui-monospace, monospace",
                  borderTop: "1px dashed rgba(255,255,255,0.05)",
                  paddingTop: 4,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ opacity: 0.75 }}>
                    {ageLabel(now - w.ts)} · {shortUuid(w.characteristic)}
                    {w.opcode != null
                      ? ` · 0x${w.opcode.toString(16).padStart(2, "0")}`
                      : ""}
                  </span>
                  <span style={{ color: w.success ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
                    {w.success ? "ok" : "fail"}
                  </span>
                </div>
                <div style={{ opacity: 0.85, wordBreak: "break-all" }}>{w.hex || "—"}</div>
                {w.error ? (
                  <div style={{ color: "#fca5a5", marginTop: 2 }}>{w.error}</div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
