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
} from "./use-ble-inspector";

type Row = {
  label: string;
  value: string;
  ok: boolean;
  source: string;
  note?: string;
  ageMs?: number;
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
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
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

  // Per-characteristic counter table.
  const charStats: CharStat[] = useMemo(
    () =>
      Object.values(inspector.perChar).sort(
        (a, b) => b.lastAt - a.lastAt,
      ),
    [inspector.perChar],
  );

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
          Green dot = metric flowing right now. Grey = silent. If a metric stays
          grey while the band is connected, check (1) the GATT services list — is
          the characteristic even advertised? (2) the per-characteristic notify
          count — is it incrementing? (3) the raw bytes — do they match the
          decoder. Every value below is real or empty, never demo.
        </div>
      </div>

      <Section title="Connection" rows={connection} />
      <Section title="Vitals (PPG)" rows={health} />
      <Section title="Activity" rows={activity} />
      <Section title="Motion (IMU)" rows={imu} />
      <Section title="Session engine" rows={session} />
      <Section title="Sleep pipeline" rows={sleep} />
      <Section title="Tab wiring" rows={tabs} />

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
    </div>
  );
}
