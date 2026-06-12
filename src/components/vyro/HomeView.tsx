import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/profile.functions";
import { Card, EmptyState, PageHeader, Pill, Stat } from "./shared";
import { useLiveMetrics, fmtNum } from "./useLiveMetrics";
import type { ViewId } from "./Layout";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function HomeView({ setView }: { setView: (v: ViewId) => void }) {
  const fetchProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const first = (profile?.display_name || "").trim().split(/\s+/)[0] || "Athlete";

  const m = useLiveMetrics();
  const statusTone = !m.connected ? (m.connecting ? "warn" : "off") : m.sessionState === "live" ? "live" : "warn";
  const statusText = !m.connected
    ? (m.connecting ? "Connecting…" : "Watch offline")
    : m.sessionState === "live" ? "Live session" : "Connected · idle";

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Athlete Dashboard"
        title={`${greeting()}, ${first}.`}
        subtitle={m.connected
          ? "Live IMU data streaming from your VYRO band."
          : "Pair your band to stream live motion data into every widget."}
        action={<Pill tone={statusTone} pulse={m.sessionState === "live"}>{statusText}</Pill>}
      />

      {!m.pairedId && (
        <EmptyState
          title="No band paired"
          hint="Pair your VYRO band to start streaming swings, peaks, and reaction times."
          action={
            <button
              onClick={() => setView("profile")}
              className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-black/85"
            >
              Pair your band
            </button>
          }
        />
      )}

      {/* Event counts */}
      <Card eyebrow="Live · From Watch" title="Motion events this session">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Swings" value={m.connected ? m.counts.swing : "—"} />
          <Stat label="Rapid starts" value={m.connected ? m.counts.rapid_start : "—"} />
          <Stat label="Bursts" value={m.connected ? m.counts.burst : "—"} />
          <Stat label="Direction Δ" value={m.connected ? m.counts.direction_change : "—"} />
        </div>
      </Card>

      {/* Peak motion */}
      <Card eyebrow="Peak IMU" title="Maximum motion seen">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Peak accel" value={fmtNum(m.peakG, m.connected, 2)} unit="g" />
          <Stat label="Peak gyro" value={fmtNum(m.peakDps, m.connected, 0)} unit="dps" />
          <Stat label="Peak jerk" value={fmtNum(m.peakJerk, m.connected, 1)} unit="g/s" />
        </div>
      </Card>

      {/* Swing quality */}
      <Card eyebrow="Swing Quality" title="Per-swing analytics">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Max intensity" value={fmtNum(m.swingIntMax, m.connected, 0)} unit="/100" />
          <Stat label="Avg intensity (10)" value={fmtNum(m.swingIntAvg, m.connected, 0)} unit="/100" />
          <Stat label="Max duration" value={fmtNum(m.swingDurMax, m.connected, 0)} unit="ms" />
          <Stat label="Avg duration (10)" value={fmtNum(m.swingDurAvg, m.connected, 0)} unit="ms" />
        </div>
      </Card>

      {/* Reaction + throughput */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card eyebrow="Reaction" title="Fastest direction change">
          <Stat label="Min gap" value={fmtNum(m.reactMin, m.connected, 0)} unit="ms"
                hint={m.reactMin == null && m.connected ? "No direction changes yet" : undefined} />
        </Card>
        <Card eyebrow="Throughput" title="Event rate">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Events / min" value={m.connected ? m.eventsLastMin : "—"} hint="rolling 60s" />
            <Stat label="Total events" value={m.connected ? m.events.length : "—"} hint="this session" />
          </div>
        </Card>
      </div>

      <button
        onClick={() => setView("session")}
        className="w-full rounded-2xl border border-emerald-600/30 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-100"
      >
        Open session console →
      </button>
    </div>
  );
}
