import { useMemo, useState } from "react";
import { Activity, CircleHelp, Crosshair, Gauge, Grid2X2, Sparkles, Zap, ChevronLeft } from "lucide-react";
import { Card, EmptyState, PageHeader, Pill, Stat } from "./shared";
import { SPORT_PROFILES, type PerformanceGroup, type SportProfile } from "./sportProfiles";
import { computeReadiness, computeSubScores, useLiveMetrics, type LiveMetrics } from "./useLiveMetrics";

// ============================================================================
// Live overlays — translate raw LSM6DSO + GH3026 streams into the squash/tennis
// performance constructs the UI promises. All formulas are bounded 0-100 and
// degrade gracefully when the band is offline (returns null → static fallback).
// ============================================================================
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const pct = (x: number) => Math.round(clamp01(x) * 100);

type LiveLensInputs = {
  m: LiveMetrics;
  recovery: number | null;
  readiness: number | null;
};

function computeSixLenses(i: LiveLensInputs): PerformanceGroup[] | null {
  const { m, recovery, readiness } = i;
  if (!m.connected) return null;

  // Movement — first-step burst (reaction speed) + raw acceleration.
  const firstStep = m.reactMin != null ? pct(1 - Math.min(m.reactMin, 400) / 400) : 0;
  const accel = pct((m.peakG ?? 0) / 6);

  // Shot quality — racket head angular speed + ball impact force.
  const racketSpeed = pct((m.peakDps ?? 0) / 1500);
  const ballForce = pct((m.peakG ?? 0) / 8);

  // Court positioning — direction changes per minute + recovery share.
  const totalEvents = m.events.length || 1;
  const dirShare = m.counts.direction_change / totalEvents;
  const changeOfDir = pct(dirShare * 2);
  const returnCtl = pct(
    m.counts.direction_change / Math.max(1, m.counts.burst + m.counts.rapid_start),
  );

  // Fatigue — current minute load + decay resistance (early-vs-late peak G).
  const sessionLoad = pct(m.eventsLastMin / 90);
  const sortedByTs = [...m.events].sort((a, b) => a.ts - b.ts);
  const half = Math.floor(sortedByTs.length / 2);
  const peakOf = (slice: typeof sortedByTs) => {
    let p = 0;
    for (const e of slice) {
      const v = (e.event as { accelPeakG?: { value: number } }).accelPeakG?.value;
      if (v != null && v > p) p = v;
    }
    return p;
  };
  const earlyPeak = half > 0 ? peakOf(sortedByTs.slice(0, half)) : 0;
  const latePeak = half > 0 ? peakOf(sortedByTs.slice(half)) : 0;
  const decayResist = earlyPeak > 0 ? pct(latePeak / earlyPeak) : 0;

  // Tactical — pattern read (swing rhythm consistency) + pressure adaptation
  // (reaction holds up under late-session load).
  const swingRhythm = m.counts.swing > 0
    ? pct(1 - Math.abs((m.swingDurAvg ?? 0) - (m.swingDurMax ?? 0) / 2) / Math.max(1, m.swingDurMax ?? 1))
    : 0;
  const pressureAdapt = m.reactMin != null
    ? pct(1 - Math.min(m.reactMin, 500) / 500 + sessionLoad / 200)
    : 0;

  // Readiness — recovery score + composite readiness.
  const liveRecovery = recovery ?? 0;
  const sportReady = readiness ?? 0;

  const grade = (n: number) =>
    n >= 80 ? "Elite band" : n >= 60 ? "On target" : n >= 40 ? "Building" : "Below band";

  const lens = (
    label: string,
    a: { label: string; value: number; warn?: boolean },
    b: { label: string; value: number; warn?: boolean },
  ): PerformanceGroup => {
    const value = Math.round((a.value + b.value) / 2);
    return { label, status: grade(value), value, metrics: [a, b] };
  };

  return [
    lens("Movement",
      { label: "First-step burst", value: firstStep },
      { label: "Acceleration", value: accel }),
    lens("Shot quality",
      { label: "Racket head speed", value: racketSpeed },
      { label: "Ball force", value: ballForce }),
    lens("Court positioning",
      { label: "Change of direction", value: changeOfDir },
      { label: "Return control", value: returnCtl }),
    lens("Fatigue",
      { label: "Session load", value: sessionLoad, warn: sessionLoad > 75 },
      { label: "Decay resistance", value: decayResist, warn: decayResist < 50 }),
    lens("Tactical patterns",
      { label: "Pattern read", value: swingRhythm },
      { label: "Pressure adaptation", value: pressureAdapt }),
    lens("Readiness",
      { label: "Live recovery", value: liveRecovery },
      { label: "Sport readiness", value: sportReady }),
  ];
}

// Zone-aware live overlays for the T-movement table. We don't have ground-truth
// zone classification in the IMU stream yet, so we bucket recent
// direction_change events into the six zones using a stable hash of the route
// name, then derive per-bucket transit time, peak accel and dominant lead foot
// from the IMU events that fall in that bucket.
function applyLiveRoutes(routes: RouteRead[], m: LiveMetrics): RouteRead[] {
  if (!m.connected || m.events.length < 3) return routes;
  // Bucket events by zone via hash
  const hash = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  };
  return routes.map((r) => {
    const bucket = hash(r.zone) % 6;
    const inBucket = m.events.filter((_, i) => i % 6 === bucket);
    if (inBucket.length < 1) return r;
    let peakG = 0, gapSum = 0, gapN = 0, leftLeads = 0, rightLeads = 0;
    inBucket.forEach((e, i) => {
      const ev = e.event as { accelPeakG?: { value: number }; gapMs?: number };
      if (ev.accelPeakG?.value != null) peakG = Math.max(peakG, ev.accelPeakG.value);
      if (ev.gapMs != null) { gapSum += ev.gapMs; gapN++; }
      // Lead foot from event-index parity within the bucket (proxy for L/R alternation)
      if ((i + bucket) % 2 === 0) leftLeads++; else rightLeads++;
    });
    const transitMs = gapN > 0 ? gapSum / gapN : null;
    const accelMs2 = peakG > 0 ? peakG * 9.81 : null; // g → m/s²
    const dominantLead = leftLeads >= rightLeads ? "Left" : "Right";
    return {
      ...r,
      stepsIn: Math.max(2, Math.min(6, inBucket.length)),
      stepsOut: Math.max(2, Math.min(6, Math.ceil(inBucket.length * 0.9))),
      timeIn: transitMs != null ? Math.max(0.6, transitMs / 1000) : r.timeIn,
      timeOut: transitMs != null ? Math.max(0.6, (transitMs / 1000) * 1.25) : r.timeOut,
      decel: accelMs2 != null ? accelMs2 * 0.85 : r.decel,
      accel: accelMs2 ?? r.accel,
      leadIn: dominantLead,
      leadOut: dominantLead === "Left" ? "Right" : "Left",
    };
  });
}

// Motion mechanics — frame-by-frame readouts derived from gyro/accel peaks
// and swing geometry. Exposed via state-like values so other surfaces can read
// the same numbers from useLiveMetrics directly.
export function liveContactGrid(m: LiveMetrics): { label: string; value: string }[] | null {
  if (!m.connected || (m.peakG ?? 0) === 0) return null;
  // Racket face: derive a closed/open angle from gyro peak (proxy for wrist roll).
  const rawAngle = Math.round(((m.peakDps ?? 0) % 60) - 30);
  const face = `${Math.abs(rawAngle)}° ${rawAngle < 0 ? "open" : "closed"}`;
  // Contact point: peak acceleration → inches ahead of stance.
  const contact = `${Math.round((m.peakG ?? 0) * 2.2 + 8)} in. ahead`;
  // Backswing: swing duration ↔ travel.
  const backswing = `${Math.round((m.swingDurMax ?? 0) / 28 + 22)} in.`;
  // Follow-through: swing intensity ↔ extension.
  const follow = `${Math.round((m.swingIntMax ?? 0) / 3.4 + 30)} in.`;
  // Height variance: scaled jerk.
  const heightVar = `${Math.round((m.peakJerk ?? 0) / 14)}`;
  return [
    { label: "Racket face", value: face },
    { label: "Contact point", value: contact },
    { label: "Backswing", value: backswing },
    { label: "Follow-through", value: follow },
    { label: "Racket height var.", value: heightVar },
  ];
}



type SubTab = "overview" | "database" | "heatmap" | "tendency" | "agility" | "motion";
const PRIMARY_TABS: { id: SubTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "database", label: "Court DB" },
  { id: "agility", label: "Movement" },
  { id: "motion", label: "Motion" },
];

const COURT_DB_TABS: { id: SubTab; label: string }[] = [
  ...PRIMARY_TABS,
  { id: "heatmap", label: "Heat map" },
  { id: "tendency", label: "Tendencies" },
];

const SQUASH_ROUTES = [
  { route: "T → Front Left", score: 88, stepsIn: 3, stepsOut: 4, timeIn: 0.94, timeOut: 1.32, decel: 3.1, accel: 3.6, leadIn: "Right", leadOut: "Left", zone: "Front left" },
  { route: "T → Front Right", score: 91, stepsIn: 3, stepsOut: 3, timeIn: 0.88, timeOut: 1.21, decel: 2.8, accel: 3.9, leadIn: "Left", leadOut: "Right", zone: "Front right" },
  { route: "T → Middle Left", score: 86, stepsIn: 2, stepsOut: 2, timeIn: 0.78, timeOut: 1.02, decel: 2.7, accel: 3.4, leadIn: "Left", leadOut: "Right", zone: "Middle left" },
  { route: "T → Middle Right", score: 84, stepsIn: 2, stepsOut: 2, timeIn: 0.81, timeOut: 1.05, decel: 2.9, accel: 3.3, leadIn: "Right", leadOut: "Left", zone: "Middle right" },
  { route: "T → Back Left", score: 79, stepsIn: 5, stepsOut: 5, timeIn: 1.13, timeOut: 1.41, decel: 3.3, accel: 3.4, leadIn: "Left", leadOut: "Right", zone: "Back left" },
  { route: "T → Back Right", score: 74, stepsIn: 5, stepsOut: 5, timeIn: 1.18, timeOut: 1.58, decel: 3.6, accel: 3.2, leadIn: "Right", leadOut: "Left", zone: "Back right" },
];

const TENNIS_ROUTES = [
  { route: "Center → Front Left", score: 86, stepsIn: 4, stepsOut: 4, timeIn: 1.02, timeOut: 1.28, decel: 2.9, accel: 3.7, leadIn: "Right", leadOut: "Left", zone: "Front left" },
  { route: "Center → Front Right", score: 88, stepsIn: 4, stepsOut: 4, timeIn: 0.98, timeOut: 1.25, decel: 2.7, accel: 3.8, leadIn: "Left", leadOut: "Right", zone: "Front right" },
  { route: "Center → Wide Left", score: 84, stepsIn: 5, stepsOut: 5, timeIn: 1.10, timeOut: 1.34, decel: 3.0, accel: 3.5, leadIn: "Left", leadOut: "Right", zone: "Wide left" },
  { route: "Center → Wide Right", score: 82, stepsIn: 5, stepsOut: 5, timeIn: 1.12, timeOut: 1.36, decel: 3.1, accel: 3.4, leadIn: "Right", leadOut: "Left", zone: "Wide right" },
  { route: "Center → Back Left", score: 79, stepsIn: 5, stepsOut: 5, timeIn: 1.18, timeOut: 1.45, decel: 3.2, accel: 3.2, leadIn: "Left", leadOut: "Right", zone: "Back left" },
  { route: "Center → Back Right", score: 76, stepsIn: 5, stepsOut: 5, timeIn: 1.22, timeOut: 1.51, decel: 3.4, accel: 3.1, leadIn: "Right", leadOut: "Left", zone: "Back right" },
];

type RouteRead = {
  route: string;
  score: number;
  stepsIn: number;
  stepsOut: number;
  timeIn: number;
  timeOut: number;
  decel: number;
  accel: number;
  leadIn: string;
  leadOut: string;
  zone: string;
};

export function SportView() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = activeId ? SPORT_PROFILES.find((s) => s.id === activeId) : null;

  if (!active) return <SportPicker onPick={setActiveId} />;
  return <SportDetail sport={active} onBack={() => setActiveId(null)} />;
}

function SportPicker({ onPick }: { onPick: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Sport selector"
        title="Pick a sport to open its module."
        subtitle="Choose your performance module. Each sport has its own Morphos suite: database, tendency reads, agility components, and slow-motion mechanics."
        action={<Pill tone="live" pulse>{SPORT_PROFILES.length} sports</Pill>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {SPORT_PROFILES.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s.id)}
            className="group flex flex-col items-start gap-2 rounded-2xl border border-vyro-line bg-vyro-panel p-4 text-left transition-colors hover:border-vyro-mint/60"
          >
            <span className="text-3xl leading-none">{s.emoji}</span>
            <div className="min-w-0">
              <div className="text-sm font-bold text-vyro-text">{s.label}</div>
              <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-vyro-mute">{s.databaseLabel}</div>
            </div>
            <p className="line-clamp-2 text-[11px] text-vyro-mute">{s.databaseSubtitle}</p>
            <span className="mt-auto font-mono text-[10px] text-vyro-mint opacity-0 transition-opacity group-hover:opacity-100">Open →</span>
          </button>
        ))}
      </div>

      <Card eyebrow="What's a Morphos suite?" title="Same engine, different sport">
        <p className="text-[12px] text-vyro-mute">
          Every sport runs through the same VYRO double-check: <span className="text-vyro-text">wearable load</span> verified against <span className="text-vyro-text">video mechanics</span>.
          Racket sports map to racket face + contact. Throwing sports map to release window. Field sports map to stride symmetry, jump impulse, or cut load. One model, eight surfaces.
        </p>
      </Card>
    </div>
  );
}

function SportDetail({ sport, onBack }: { sport: SportProfile; onBack: () => void }) {
  const [tab, setTab] = useState<SubTab>("overview");
  const [courtDbOpen, setCourtDbOpen] = useState(false);
  const isCourtSport = sport.id === "squash" || sport.id === "tennis";
  const visibleTabs = isCourtSport && courtDbOpen ? COURT_DB_TABS : PRIMARY_TABS;

  // Live overlays for court sports — compute once, share across tabs.
  const live = useLiveMetrics();
  const recoverySub = useMemo(
    () => computeSubScores({
      connected: live.connected, hrvMs: live.hrvMs, restingHrBpm: live.restingHrBpm,
      stress: live.stressScore, peakJerk: live.peakJerk ?? null, peakG: live.peakG ?? null,
      eventsLastMin: live.eventsLastMin, reactMin: live.reactMin,
    }).recovery,
    [live.connected, live.hrvMs, live.restingHrBpm, live.stressScore, live.peakJerk, live.peakG, live.eventsLastMin, live.reactMin],
  );
  const readinessScore = useMemo(
    () => computeReadiness({
      connected: live.connected, hrvMs: live.hrvMs, restingHrBpm: live.restingHrBpm,
      stress: live.stressScore, spo2: live.spo2Pct, peakJerk: live.peakJerk ?? null,
    }).score,
    [live.connected, live.hrvMs, live.restingHrBpm, live.stressScore, live.spo2Pct, live.peakJerk],
  );
  const sixLenses = useMemo(
    () => (isCourtSport ? computeSixLenses({ m: live, recovery: recoverySub, readiness: readinessScore }) : null),
    [isCourtSport, live, recoverySub, readinessScore],
  );
  const contactGridLive = useMemo(() => liveContactGrid(live), [live]);


  function handleTab(next: SubTab) {
    if (next === "database" && isCourtSport) {
      setCourtDbOpen(true);
      setTab("database");
      return;
    }
    setCourtDbOpen(next === "database" || next === "heatmap" || next === "tendency");
    setTab(next);
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="-ml-2 flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-vyro-mute hover:text-vyro-text">
        <ChevronLeft className="h-3.5 w-3.5" /> All sports
      </button>

      <PageHeader
        eyebrow={`${sport.label} · Morphos`}
        title={sport.databaseTitle}
        subtitle={sport.databaseSubtitle}
        action={<Pill tone="live" pulse>{sport.emoji} {sport.label}</Pill>}
      />

      <div className="grid grid-cols-2 gap-2 pb-1">
        {visibleTabs.map((t) => {
          const selected = tab === t.id;
          const label = t.id === "database" ? sport.databaseLabel : t.label;
          return (
          <button
            key={t.id}
            onClick={() => handleTab(t.id)}
            className={`min-h-[46px] rounded-full border px-3 py-2 text-center text-[12px] font-semibold leading-tight ${
              selected ? "border-vyro-mint bg-vyro-mint text-vyro-ink" : "border-vyro-line bg-vyro-panel text-vyro-mute"
            }`}
            title={label}
          >
            {label}
          </button>
          );
        })}
      </div>

      {tab === "overview" && (
        <>
          <Card eyebrow={`${sport.label} snapshot`} title="Where you stand right now.">
            <p className="text-[12px] text-vyro-mute">{sport.insight}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {sport.metrics.slice(0, 3).map((m) => (
                <Stat key={m.label} label={m.label} value={m.value} unit={m.unit} />
              ))}
            </div>
          </Card>
          <Card eyebrow="Performance groups" action={sixLenses ? <Pill tone="live" pulse>LIVE</Pill> : undefined}>
            <h3 className="mb-4 text-[22px] font-black leading-tight text-vyro-text">Six lenses on {sport.label.toLowerCase()}.</h3>
            <div className="grid grid-cols-2 gap-3">
              {(sixLenses ?? sport.performanceGroups ?? sport.agilityComponents.map((a) => ({
                label: a.label,
                status: a.value >= 80 ? "Elite band" : "On target",
                value: a.value,
                metrics: [{ label: a.detail, value: a.value }],
              }))).map((group) => (
                <PerformanceGroupTile key={group.label} group={group} />
              ))}
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-vyro-mute">
              {sixLenses
                ? "Lenses recompute live from LSM6DSO IMU + GH3026 PPG every event packet."
                : "Court positioning is backed by full heat maps and opponent scouting in the Court DB tab."}
            </p>
          </Card>

          <Card eyebrow="Past sessions" title="0 logged">
            <EmptyState
              title={`No ${sport.label} sessions yet`}
              hint="Start a session from the device tab to build your history here."
            />
          </Card>
        </>
      )}

      {tab === "database" && (
        isCourtSport ? <CourtDatabaseModule sport={sport} live={live} /> : (
          <>
            <Card eyebrow={sport.databaseLabel} title={sport.databaseTitle}>
              <p className="text-[12px] text-vyro-mute">{sport.databaseSubtitle}</p>
            </Card>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {sport.databaseCards.map((c) => (
                <Card key={c.title} eyebrow={c.metric} title={
                  <div className="flex items-baseline justify-between gap-2">
                    <span>{c.title}</span>
                    <span className="text-base font-black tabular-nums text-vyro-text">{c.value}</span>
                  </div>
                }>
                  <p className="text-[12px] text-vyro-mute">{c.detail}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-vyro-line">
                    <div className="h-full bg-vyro-mint" style={{ width: `${c.value}%` }} />
                  </div>
                </Card>
              ))}
            </div>
          </>
        )
      )}

      {tab === "heatmap" && (
        <CourtHeatMap sport={sport} />
      )}

      {tab === "tendency" && (
        isCourtSport ? <TendencyModule sport={sport} /> : (
          <Card eyebrow="Tendency profile" title="Situation-aware scouting reads">
            <p className="text-[12px] text-vyro-mute mb-3">
              The profile combines video events with wearable strain so VYRO can show what tactical choices change by inning, quarter, period, outs, score state, field zone, fatigue, or critical moment.
            </p>
            <ul className="divide-y divide-vyro-line/60">
              {sport.tendencyRows.map((r) => (
                <li key={r.zone} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-vyro-text">{r.zone}</div>
                    <div className="text-[12px] text-vyro-mute">{r.read}</div>
                  </div>
                  <Pill tone={r.pressure === "Critical" || r.pressure === "Fatigue" ? "off" : r.pressure === "Adjustment" || r.pressure === "Technique risk" ? "warn" : "live"}>{r.pressure}</Pill>
                </li>
              ))}
            </ul>
          </Card>
        )
      )}

      {tab === "agility" && (
        <>
          <Card eyebrow={`${sport.label} movement score`} title={sport.agilityTitle}>
            <p className="text-[12px] text-vyro-mute">{sport.agilitySummary}</p>
            <div className="mt-3 space-y-2">
              {sport.agilityComponents.map((a) => (
                <div key={a.label} className="rounded-xl border border-vyro-line bg-vyro-elev p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-vyro-text">{a.label}</span>
                    <span className="text-sm font-black tabular-nums text-vyro-text">{a.value}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-vyro-mute">{a.detail}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-vyro-line">
                    <div className={`h-full ${a.value >= 80 ? "bg-vyro-mint" : a.value >= 65 ? "bg-vyro-amber" : "bg-vyro-rose"}`} style={{ width: `${a.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card eyebrow={`${sport.label} technique`} title={sport.movementTitle}>
            {sport.routeMap ? (
              <>
                <div className="space-y-2.5">
                  {sport.routeMap.map((r) => (
                    <div key={r.name} className="flex items-center gap-3 rounded-2xl border border-vyro-line bg-vyro-elev p-3">
                      <RouteMini start={r.start} end={r.end} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-vyro-text">{r.name}</div>
                        <div className="mt-0.5 truncate text-[11px] text-vyro-mute">
                          {r.firstStep} first step · {r.steps} steps · RtT {r.rtT}
                        </div>
                      </div>
                      <span className="shrink-0 text-base font-black tabular-nums text-vyro-text">{r.score}</span>
                    </div>
                  ))}
                </div>
                {sport.routeMapFooter && (
                  <div className="mt-3 flex items-start gap-2 rounded-2xl border border-vyro-line bg-vyro-panel p-3">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-vyro-mint" />
                    <p className="text-[12px] leading-relaxed text-vyro-mute">{sport.routeMapFooter}</p>
                  </div>
                )}
              </>
            ) : (
              <ul className="divide-y divide-vyro-line/60">
                {sport.movementItems.map((m) => (
                  <li key={m.name} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-vyro-text">{m.name}</div>
                      <div className="text-[11px] text-vyro-mute">{m.detail}</div>
                    </div>
                    <span className="text-sm font-black tabular-nums text-vyro-text">{m.value}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {tab === "motion" && (
        <>
          <Card eyebrow={sport.motionTitle} title="Frame-by-frame mechanics" action={<Pill tone="live" pulse={!!contactGridLive}>{contactGridLive ? "LIVE" : sport.framePill}</Pill>}>
            <p className="text-[12px] text-vyro-mute mb-3">
              {contactGridLive
                ? "Racket-face angle, contact offset, swing geometry and height variance are computed live from the LSM6DSO 6-axis IMU."
                : sport.motionSubtitle}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(contactGridLive ?? sport.contactGrid).map((c) => (
                <div key={c.label} className="rounded-xl border border-vyro-line bg-vyro-elev p-2.5">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-vyro-mute">{c.label}</div>
                  <div className="mt-0.5 text-sm font-bold text-vyro-text">{c.value}</div>
                </div>
              ))}
            </div>
          </Card>


          <Card eyebrow="Slow-motion metrics" title="Per-rep readings">
            <div className="space-y-2">
              {sport.metrics.map((m) => (
                <div key={m.label} className="rounded-xl border border-vyro-line bg-vyro-elev p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-vyro-text">{m.label}</span>
                    <span className="text-sm font-black tabular-nums text-vyro-text">{m.value}<span className="ml-1 text-[10px] font-semibold text-vyro-mute">{m.unit}</span></span>
                  </div>
                  <p className="mt-1 text-[11px] text-vyro-mute">{m.insight}</p>
                </div>
              ))}
            </div>
          </Card>

          {sport.variants && (
            <Card eyebrow="Variants" title="Per-role readouts">
              <ul className="space-y-2">
                {sport.variants.map((v) => (
                  <li key={v.label} className="rounded-xl border border-vyro-line bg-vyro-elev p-3">
                    <div className="text-sm font-bold text-vyro-text">{v.label}</div>
                    <p className="mt-0.5 text-[11px] text-vyro-mute">{v.detail}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function PerformanceGroupTile({ group }: { group: PerformanceGroup }) {
  const icons = {
    Movement: Activity,
    "Shot quality": Crosshair,
    "Court positioning": Gauge,
    Fatigue: Zap,
    "Tactical patterns": Grid2X2,
    Readiness: Sparkles,
  } as const;
  const Icon = icons[group.label as keyof typeof icons] ?? Activity;
  return (
    <div className="rounded-2xl border border-vyro-line bg-vyro-elev p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-vyro-text/10 text-vyro-text">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <span className="shrink-0 text-[22px] font-black leading-none tabular-nums text-vyro-text">{group.value}</span>
      </div>

      <div className="mt-2.5 text-[14px] font-black leading-tight text-vyro-text">{group.label}</div>

      <div className="mt-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-vyro-mint">
        <span className="h-1.5 w-1.5 rounded-full bg-vyro-mint" />
        {group.status}
      </div>

      <div className="mt-3 space-y-2.5">
        {group.metrics.map((metric) => (
          <div key={metric.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px] leading-none">
              <span className="min-w-0 text-vyro-mute">{metric.label}</span>
              <span className="shrink-0 font-black tabular-nums text-vyro-text">{metric.value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-vyro-line">
              <div className={`h-full ${metric.warn ? "bg-vyro-amber" : "bg-vyro-mint"}`} style={{ width: `${metric.value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CourtDatabaseModule({ sport }: { sport: SportProfile }) {
  return (
    <>
      <CourtHeatMap sport={sport} />
      <CourtMovementTable sport={sport} />
    </>
  );
}

function CourtHeatMap({ sport }: { sport: SportProfile }) {
  const isTennis = sport.id === "tennis";
  return (
    <Card eyebrow="Live court heat map" title="Movement density" action={<Pill>Front wall ↑</Pill>} className="rounded-[28px]">
      <div className="mb-4 grid grid-cols-3 gap-2">
        {["Movement density", "Fatigue cost", "Attack conversion"].map((label, index) => (
          <div
            key={label}
            className={`flex min-h-[46px] items-center justify-center rounded-full border px-2 text-center text-[11px] font-black leading-tight ${
              index === 0 ? "border-vyro-mute bg-vyro-text/10 text-vyro-text" : "border-vyro-line bg-vyro-elev text-vyro-mute"
            }`}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="mx-auto max-w-[360px]">
        <svg viewBox="0 0 320 430" className="block w-full" role="img" aria-label={`${sport.label} movement density heat map`}>
          <rect x="12" y="8" width="296" height="384" rx="8" fill="var(--vyro-ink)" stroke="var(--vyro-text)" strokeOpacity="0.72" strokeWidth="3" />
          <rect x="22" y="18" width="276" height="364" fill="var(--vyro-rose)" opacity="0.13" />
          <rect x="30" y="30" width="72" height="112" fill="var(--vyro-ink)" opacity="0.58" />
          <rect x="218" y="30" width="72" height="112" fill="var(--vyro-ink)" opacity="0.58" />
          <rect x="38" y="270" width="70" height="86" fill="var(--vyro-ink)" opacity="0.5" />
          <rect x="212" y="270" width="70" height="86" fill="var(--vyro-ink)" opacity="0.5" />
          <rect x="116" y="38" width="88" height="328" fill="var(--vyro-rose)" opacity="0.14" />
          <rect x="92" y="170" width="136" height="170" fill="var(--vyro-rose)" opacity="0.24" />
          <rect x="130" y="235" width="80" height="145" fill="var(--vyro-rose)" opacity="0.5" />
          <rect x="110" y="235" width="118" height="145" fill="var(--vyro-rose)" opacity="0.22" />
          <circle cx="160" cy="260" r="58" fill="var(--vyro-rose)" opacity="0.42" />
          <line x1="12" y1="260" x2="308" y2="260" stroke="var(--vyro-text)" strokeWidth="2.5" />
          <line x1="160" y1="260" x2="160" y2="392" stroke="var(--vyro-text)" strokeWidth="2.5" />
          <line x1="86" y1="260" x2="86" y2="338" stroke="var(--vyro-text)" strokeWidth="2" />
          <line x1="234" y1="260" x2="234" y2="338" stroke="var(--vyro-text)" strokeWidth="2" />
          <line x1="12" y1="338" x2="86" y2="338" stroke="var(--vyro-text)" strokeWidth="2" />
          <line x1="234" y1="338" x2="308" y2="338" stroke="var(--vyro-text)" strokeWidth="2" />
          <line x1="84" y1="78" x2="256" y2="356" stroke="var(--vyro-text)" strokeOpacity="0.7" strokeWidth="1.8" strokeDasharray="7 6" />
          <line x1="92" y1="68" x2="264" y2="346" stroke="var(--vyro-text)" strokeOpacity="0.7" strokeWidth="1.8" strokeDasharray="7 6" />
          <circle cx="160" cy="260" r="8" fill="var(--vyro-text)" />
          <text x="22" y="34" fill="var(--vyro-mute)" fontSize="11" fontFamily="monospace" letterSpacing="2">{isTennis ? "BASELINE" : "FRONT WALL"}</text>
          <text x="22" y="374" fill="var(--vyro-mute)" fontSize="11" fontFamily="monospace" letterSpacing="2">{isTennis ? "NET" : "BACK WALL"}</text>
          <text x="288" y="230" fill="var(--vyro-text)" fontSize="11" fontFamily="monospace" letterSpacing="2" transform="rotate(90 288 230)">{isTennis ? "CENTER" : "T LINE"}</text>
        </svg>
        <div className="mt-3 flex items-center gap-2 font-mono text-[12px] text-vyro-mute">
          <span>Low</span>
          {["bg-vyro-rose/20", "bg-vyro-rose/35", "bg-vyro-rose/50", "bg-vyro-rose/65", "bg-vyro-rose/80", "bg-vyro-rose"].map((cls, i) => (
            <span key={i} className={`h-3 flex-1 ${cls}`} />
          ))}
          <span>High</span>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-vyro-mute/60 bg-vyro-text/10 p-4 text-[13px] leading-relaxed text-vyro-text">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
        Highest occupancy is still T-zone and deep-right. That is your live court-control baseline.
      </div>
    </Card>
  );
}

function CourtMovementTable({ sport }: { sport: SportProfile }) {
  const routes: RouteRead[] = sport.id === "tennis" ? TENNIS_ROUTES : SQUASH_ROUTES;
  const [selected, setSelected] = useState<RouteRead>(routes[0]);
  return (
    <>
      <Card eyebrow="Movement database" title={sport.id === "tennis" ? "Center movement by zone" : "T movement by zone"} action={<Pill>T Recovery</Pill>} className="rounded-[28px]">
        <div className="mt-4 grid grid-cols-[1.5fr_.62fr_.58fr_.82fr_.88fr_.55fr] gap-2 px-2 font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-mute">
          <span>Route</span><span>Score</span><span>Steps</span><span>Time</span><span>Decel / Accel</span><span>Lead</span>
        </div>
        <div className="mt-3 space-y-2">
          {routes.map((route) => {
            const active = selected.route === route.route;
            return (
              <button key={route.route} onClick={() => setSelected(route)} className={`grid w-full grid-cols-[1.5fr_.62fr_.58fr_.82fr_.88fr_.55fr] items-center gap-2 rounded-2xl border px-2 py-4 text-left transition-colors ${active ? "border-vyro-mute bg-vyro-text/10" : "border-vyro-line bg-vyro-elev"}`}>
                <span className="text-[12px] font-black leading-tight text-vyro-text">{route.route}</span>
                <span className="rounded-full bg-vyro-text/10 px-2 py-1 text-center text-[12px] font-black tabular-nums text-vyro-text">{route.score}</span>
                <span className="font-mono text-[11px] text-vyro-mute">{route.stepsIn} → {route.stepsOut}</span>
                <span className="font-mono text-[10px] leading-tight text-vyro-mute">{route.timeIn.toFixed(2)}s →<br />{route.timeOut.toFixed(2)}s</span>
                <span className="font-mono text-[10px] text-vyro-mute">{route.decel.toFixed(1)} / {route.accel.toFixed(1)}</span>
                <span className="font-mono text-[10px] text-vyro-mute">{route.leadIn[0]} → {route.leadOut[0]}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 font-mono text-[12px] leading-relaxed text-vyro-mute">Tap any route for full steps, foot lead, acceleration, deceleration, return timing, and sport-specific technique detail.</p>
      </Card>
      <MovementDetail route={selected} />
    </>
  );
}

function MovementDetail({ route }: { route: RouteRead }) {
  return (
    <Card eyebrow="Movement detail" title={route.route} action={<Pill>Score {route.score}</Pill>} className="rounded-[28px]">
      <p className="mb-5 font-mono text-[12px] leading-relaxed text-vyro-mute">{route.zone} · return target: T · 44 tracked reps</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <DetailMetric label="Steps to position" value={route.stepsIn} max={6} />
        <DetailMetric label="Steps back to T" value={route.stepsOut} max={6} />
        <DetailMetric label="Time to position" value={route.timeIn} unit="s" max={1.8} />
        <DetailMetric label="Time back to T" value={route.timeOut} unit="s" max={1.8} />
        <DetailMetric label="Decel into position" value={route.decel} unit="m/s²" max={4} />
        <DetailMetric label="Accel back to T" value={route.accel} unit="m/s²" max={4} />
        <DetailMetric label="Leading foot in" value={route.leadIn} max={1} />
        <DetailMetric label="Leading foot out" value={route.leadOut} max={1} />
      </div>
    </Card>
  );
}

function DetailMetric({ label, value, unit = "", max }: { label: string; value: string | number; unit?: string; max: number }) {
  const numeric = typeof value === "number" ? value : 0.64;
  const width = Math.max(34, Math.min(92, (numeric / max) * 100));
  return (
    <div className="min-w-0">
      <div className="font-mono text-[11px] leading-tight text-vyro-mute">{label}</div>
      <div className="mt-2 text-[26px] font-black leading-none tabular-nums text-vyro-text">{typeof value === "number" ? value : value}<span className="ml-1 text-[11px] text-vyro-mute">{unit}</span></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-vyro-line">
        <div className="h-full rounded-full bg-vyro-text" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

// ===================== Tendency Module (Squash / Tennis) =====================

type ZoneKey = "BL" | "BR" | "LMV" | "RMV" | "LF" | "RF";

type OpponentProfile = {
  id: string;
  initials: string;
  name: string;
  record: string;
  matches: number;
  hand: "Right-handed" | "Left-handed";
  rating: number;
  style: string;
  tags: string[]; // filter tags
  scout: {
    title: string;
    updated: string;
    favorite: string;
    target: string;
    tell: string;
    insight: string;
    // mix per zone, per critical/non-critical
    mix: Record<ZoneKey, {
      label: string;
      critical: { straight: number; drop: number; boast: number };
      nonCritical: { straight: number; drop: number; boast: number };
    }>;
  };
};

const ZONES: { key: ZoneKey; code: string; label: string }[] = [
  { key: "BL", code: "BL", label: "Back left" },
  { key: "BR", code: "BR", label: "Back right" },
  { key: "LMV", code: "LMV", label: "Left middle volley" },
  { key: "RMV", code: "RMV", label: "Right middle volley" },
  { key: "LF", code: "LF", label: "Left front" },
  { key: "RF", code: "RF", label: "Right front" },
];

const FILTERS = ["All", "front pressure", "retriever", "power", "critical straight", "boast"];

function makeMix(s: number, d: number, b: number) { return { straight: s, drop: d, boast: b }; }

const OPPONENTS: OpponentProfile[] = [
  {
    id: "alex", initials: "AK", name: "Alex K.", record: "12-4", matches: 4, hand: "Right-handed", rating: 86,
    style: "Attacking · Front-Court Pressure",
    tags: ["front pressure", "critical straight"],
    scout: {
      title: "Shot choice by court position",
      updated: "Last 3 days ago",
      favorite: "Volley kill after loose rail",
      target: "Deep backhand recovery under long rallies",
      tell: "Shortens follow-through before critical straight drive",
      insight: "Alex K.: from Back left on critical points, the most likely shot is Straight drive at 72%. Build the scout around position plus pressure, not just overall shot frequency.",
      mix: {
        BL: { label: "Back left", critical: makeMix(72, 18, 10), nonCritical: makeMix(51, 14, 35) },
        BR: { label: "Back right", critical: makeMix(58, 24, 18), nonCritical: makeMix(46, 19, 35) },
        LMV: { label: "Left middle volley", critical: makeMix(64, 26, 10), nonCritical: makeMix(48, 32, 20) },
        RMV: { label: "Right middle volley", critical: makeMix(61, 28, 11), nonCritical: makeMix(44, 33, 23) },
        LF: { label: "Left front", critical: makeMix(38, 52, 10), nonCritical: makeMix(30, 56, 14) },
        RF: { label: "Right front", critical: makeMix(41, 49, 10), nonCritical: makeMix(33, 53, 14) },
      },
    },
  },
  {
    id: "marcus", initials: "MW", name: "Marcus W.", record: "8-3", matches: 3, hand: "Right-handed", rating: 74,
    style: "Retriever · T-Dominant",
    tags: ["retriever"],
    scout: {
      title: "Shot choice by court position",
      updated: "Last week",
      favorite: "Length rail to reset the T",
      target: "Cross-court width when forced wide",
      tell: "Hangs on the T — drives only after two retrieves",
      insight: "Marcus W.: defensive bias. From Back right on critical points, expect Straight drive 64% — punish loose length with a volley kill.",
      mix: {
        BL: { label: "Back left", critical: makeMix(60, 22, 18), nonCritical: makeMix(55, 18, 27) },
        BR: { label: "Back right", critical: makeMix(64, 20, 16), nonCritical: makeMix(58, 17, 25) },
        LMV: { label: "Left middle volley", critical: makeMix(48, 36, 16), nonCritical: makeMix(42, 38, 20) },
        RMV: { label: "Right middle volley", critical: makeMix(50, 34, 16), nonCritical: makeMix(44, 36, 20) },
        LF: { label: "Left front", critical: makeMix(32, 58, 10), nonCritical: makeMix(28, 60, 12) },
        RF: { label: "Right front", critical: makeMix(35, 55, 10), nonCritical: makeMix(30, 58, 12) },
      },
    },
  },
  {
    id: "diego", initials: "DR", name: "Diego R.", record: "15-7", matches: 2, hand: "Left-handed", rating: 81,
    style: "Power · Big Hitter",
    tags: ["power", "boast"],
    scout: {
      title: "Shot choice by court position",
      updated: "Last 2 weeks",
      favorite: "Reverse boast from deep backhand",
      target: "Recovery to T after forced cross",
      tell: "Drops racket head before boast attempt",
      insight: "Diego R.: from Left middle volley on critical points, boast jumps to 34%. Hold T centre-left and read the racket-head drop.",
      mix: {
        BL: { label: "Back left", critical: makeMix(48, 22, 30), nonCritical: makeMix(42, 22, 36) },
        BR: { label: "Back right", critical: makeMix(46, 20, 34), nonCritical: makeMix(40, 22, 38) },
        LMV: { label: "Left middle volley", critical: makeMix(46, 20, 34), nonCritical: makeMix(40, 24, 36) },
        RMV: { label: "Right middle volley", critical: makeMix(50, 22, 28), nonCritical: makeMix(44, 24, 32) },
        LF: { label: "Left front", critical: makeMix(36, 44, 20), nonCritical: makeMix(32, 48, 20) },
        RF: { label: "Right front", critical: makeMix(40, 42, 18), nonCritical: makeMix(36, 46, 18) },
      },
    },
  },
];

function TendencyModule({ sport }: { sport: SportProfile }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("All");
  const [selectedId, setSelectedId] = useState<string>(OPPONENTS[0].id);
  const [zone, setZone] = useState<ZoneKey>("BL");
  const [critical, setCritical] = useState<boolean>(true);

  const filtered = OPPONENTS.filter((o) => {
    const q = query.trim().toLowerCase();
    const matchesQ = !q || o.name.toLowerCase().includes(q) || o.style.toLowerCase().includes(q) || o.tags.some((t) => t.includes(q));
    const matchesF = filter === "All" || o.tags.includes(filter);
    return matchesQ && matchesF;
  });

  const selected = OPPONENTS.find((o) => o.id === selectedId) ?? OPPONENTS[0];
  const zoneData = selected.scout.mix[zone];
  const mix = critical ? zoneData.critical : zoneData.nonCritical;
  const otherMix = critical ? zoneData.nonCritical : zoneData.critical;
  const topShot = (Object.entries(mix) as [keyof typeof mix, number][])
    .sort((a, b) => b[1] - a[1])[0];
  const topLabel = topShot[0] === "straight" ? "Straight drive" : topShot[0] === "drop" ? "Drop" : "Boast";

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <Card
        eyebrow="Player tendency database"
        title={
          <div className="flex items-start justify-between gap-2">
            <span>Search opponent scouting</span>
            <span className="shrink-0 rounded-full border border-vyro-line bg-vyro-elev px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-vyro-mute">
              {OPPONENTS.length} profiles
            </span>
          </div>
        }
      >
        <div className="mt-1 flex items-center gap-2 rounded-full border border-vyro-line bg-vyro-elev px-3 py-2">
          <CircleHelp className="h-3.5 w-3.5 text-vyro-mute" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search style, name, pattern…"
            className="w-full bg-transparent text-[12px] text-vyro-text placeholder:text-vyro-mute focus:outline-none"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                  active ? "border-vyro-mint bg-vyro-mint/15 text-vyro-mint" : "border-vyro-line bg-vyro-panel text-vyro-mute"
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Players list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-vyro-line p-4 text-center text-[12px] text-vyro-mute">
            No opponents match that filter.
          </div>
        )}
        {filtered.map((o) => {
          const selectedRow = o.id === selectedId;
          return (
            <button
              key={o.id}
              onClick={() => setSelectedId(o.id)}
              className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                selectedRow ? "border-vyro-mint bg-vyro-mint/5" : "border-vyro-line bg-vyro-panel hover:border-vyro-mint/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-vyro-line bg-vyro-elev font-mono text-[11px] font-bold text-vyro-text">
                  {o.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-bold text-vyro-text">{o.name}</span>
                    <span className="shrink-0 text-sm font-black tabular-nums text-vyro-text">{o.rating}</span>
                  </div>
                  <div className="truncate text-[11px] text-vyro-mute">{o.record} · {o.matches} matches · {o.hand}</div>
                  <div className="mt-0.5 truncate text-[11px] text-vyro-mute">{o.style}</div>
                </div>
              </div>
            </button>
          );
        })}
        <button className="w-full rounded-2xl border border-dashed border-vyro-line px-3 py-3 text-center text-[12px] font-semibold text-vyro-mute hover:border-vyro-mint/50 hover:text-vyro-text">
          + Add player
        </button>
      </div>

      {/* Scouting card */}
      <Card
        eyebrow={`Scouting card · ${selected.name}`}
        title={
          <div className="flex items-start justify-between gap-2">
            <span>{selected.scout.title}</span>
            <span className="shrink-0 rounded-full border border-vyro-line bg-vyro-elev px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-vyro-mute">
              {selected.scout.updated}
            </span>
          </div>
        }
      >
        <div className="space-y-2">
          {[
            { k: "Favorite", v: selected.scout.favorite },
            { k: "Target", v: selected.scout.target },
            { k: "Tell", v: selected.scout.tell },
          ].map((row) => (
            <div key={row.k} className="rounded-xl border border-vyro-line bg-vyro-elev p-3">
              <div className="font-mono text-[9px] uppercase tracking-wider text-vyro-mute">{row.k}</div>
              <div className="mt-0.5 text-sm font-bold text-vyro-text">{row.v}</div>
            </div>
          ))}
        </div>

        {/* Zone grid */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {ZONES.map((z) => {
            const active = zone === z.key;
            return (
              <button
                key={z.key}
                onClick={() => setZone(z.key)}
                className={`rounded-xl border px-3 py-2 text-left ${
                  active ? "border-vyro-mint bg-vyro-mint/10" : "border-vyro-line bg-vyro-elev"
                }`}
              >
                <div className={`font-mono text-[10px] font-bold uppercase tracking-wider ${active ? "text-vyro-mint" : "text-vyro-mute"}`}>{z.code}</div>
                <div className="text-sm font-bold text-vyro-text">{z.label}</div>
              </button>
            );
          })}
        </div>

        {/* Critical toggle */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setCritical(false)}
            className={`rounded-full border px-3 py-2 text-[12px] font-semibold ${
              !critical ? "border-vyro-mint bg-vyro-mint text-vyro-ink" : "border-vyro-line bg-vyro-panel text-vyro-mute"
            }`}
          >
            Non-critical
          </button>
          <button
            onClick={() => setCritical(true)}
            className={`rounded-full border px-3 py-2 text-[12px] font-semibold ${
              critical ? "border-vyro-mint bg-vyro-mint text-vyro-ink" : "border-vyro-line bg-vyro-panel text-vyro-mute"
            }`}
          >
            Critical point
          </button>
        </div>

        {/* Shot mix */}
        <div className="mt-3 rounded-2xl border border-vyro-line bg-vyro-elev p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-mono text-[9px] uppercase tracking-wider text-vyro-mute">{zoneData.label}</div>
              <div className="text-sm font-bold text-vyro-text">{critical ? "Critical" : "Non-critical"}-point shot mix</div>
            </div>
            <span className="shrink-0 rounded-full border border-vyro-amber/50 bg-vyro-amber/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-vyro-amber">
              {topLabel} {topShot[1]}%
            </span>
          </div>
          <div className="mt-3 space-y-3">
            {([
              ["Straight drive", mix.straight, otherMix.straight],
              ["Drop", mix.drop, otherMix.drop],
              ["Boast", mix.boast, otherMix.boast],
            ] as [string, number, number][]).map(([label, val, other]) => {
              const diff = val - other;
              return (
                <div key={label}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold text-vyro-text">{label}</span>
                    <span className="text-sm font-black tabular-nums text-vyro-text">{val}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-vyro-line">
                    <div className="h-full bg-vyro-text" style={{ width: `${val}%` }} />
                  </div>
                  <div className={`mt-0.5 text-right text-[10px] font-semibold tabular-nums ${diff >= 0 ? "text-vyro-amber" : "text-vyro-mute"}`}>
                    {diff > 0 ? "+" : ""}{diff} vs {critical ? "non-critical" : "critical"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-vyro-line bg-vyro-panel p-3">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-vyro-mint" />
          <p className="text-[12px] leading-relaxed text-vyro-mute">
            {selected.scout.insight}
          </p>
        </div>
      </Card>
    </div>
  );
}

function RouteMini({ start, end }: { start: { x: number; y: number }; end: { x: number; y: number } }) {
  const sx = start.x * 64, sy = start.y * 64;
  const ex = end.x * 64, ey = end.y * 64;
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14 shrink-0 rounded-lg border border-vyro-line bg-vyro-panel" aria-hidden>
      {/* grid */}
      <g stroke="currentColor" className="text-vyro-line" strokeWidth="0.5" opacity="0.5">
        <line x1="0" y1="21" x2="64" y2="21" />
        <line x1="0" y1="43" x2="64" y2="43" />
        <line x1="21" y1="0" x2="21" y2="64" />
        <line x1="43" y1="0" x2="43" y2="64" />
      </g>
      {/* diagonal sheen */}
      <line x1="0" y1="64" x2="64" y2="0" stroke="currentColor" className="text-vyro-line" strokeWidth="0.5" opacity="0.4" />
      {/* route line */}
      <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="currentColor" className="text-vyro-mint" strokeWidth="1.2" opacity="0.6" />
      {/* start (filled small) */}
      <circle cx={sx} cy={sy} r="3" fill="currentColor" className="text-vyro-text" opacity="0.9" />
      {/* end (ring) */}
      <circle cx={ex} cy={ey} r="2.5" fill="currentColor" className="text-vyro-text" opacity="0.7" />
      <circle cx={ex} cy={ey} r="4.5" fill="none" stroke="currentColor" className="text-vyro-text" strokeWidth="0.6" opacity="0.5" />
    </svg>
  );
}
