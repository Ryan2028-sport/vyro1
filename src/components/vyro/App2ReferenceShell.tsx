import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Bell,
  Brain,
  CalendarDays,
  Heart,
  LineChart,
  MessageCircle,
  Moon,
  Plus,
  Radio,
  Settings2,
  Trophy,
  UserRound,
} from "lucide-react";
import { getMyProfile } from "@/lib/profile.functions";
import { BandPanel } from "./BandPanel";
import { CoachView } from "./CoachView";
import { RecoveryView } from "./RecoveryView";
import { SessionView } from "./SessionView";
import { SleepView } from "./SleepView";
import { SocialView } from "./SocialView";
import { SportView } from "./SportView";
import { TrendsView } from "./TrendsView";
import { computeReadiness, computeSubScores, useLiveMetrics, type LiveMetrics } from "./useLiveMetrics";
import "./app2-reference.css";

// ---------- Baseline persistence (rolling user baselines for divergence/RTP) ----------
type Baselines = {
  reactMs?: number;        // fastest rolling reaction (ms)
  reactSamples?: number[]; // last N samples for median baseline
  readiness?: number;      // 7d rolling avg readiness
  readinessSamples?: number[];
  restingHr?: number;
  hrv?: number;
};
const BASELINE_KEY = "vyro.baselines.v1";
function loadBaselines(): Baselines {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(BASELINE_KEY) || "{}"); } catch { return {}; }
}
function saveBaselines(b: Baselines) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(BASELINE_KEY, JSON.stringify(b)); } catch { /* ignore */ }
}
function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function useBaselines(m: LiveMetrics) {
  const [base, setBase] = useState<Baselines>(() => loadBaselines());
  // Throttle writes via ref
  const lastWrite = useRef(0);
  useEffect(() => {
    if (!m.connected) return;
    setBase((prev) => {
      const next: Baselines = { ...prev };
      if (m.reactMin != null) {
        const samples = [...(prev.reactSamples ?? []), m.reactMin].slice(-50);
        next.reactSamples = samples;
        next.reactMs = median(samples);
      }
      if (m.restingHrBpm != null) next.restingHr = prev.restingHr
        ? prev.restingHr * 0.9 + m.restingHrBpm * 0.1 : m.restingHrBpm;
      if (m.hrvMs != null) next.hrv = prev.hrv
        ? prev.hrv * 0.9 + m.hrvMs * 0.1 : m.hrvMs;
      const now = Date.now();
      if (now - lastWrite.current > 5000) {
        lastWrite.current = now;
        saveBaselines(next);
      }
      return next;
    });
  }, [m.connected, m.reactMin, m.restingHrBpm, m.hrvMs]);

  const recordReadiness = (score: number | null) => {
    if (score == null) return;
    setBase((prev) => {
      const samples = [...(prev.readinessSamples ?? []), score].slice(-7);
      const next = { ...prev, readinessSamples: samples, readiness: Math.round(samples.reduce((a, b) => a + b, 0) / samples.length) };
      saveBaselines(next);
      return next;
    });
  };
  return { base, recordReadiness };
}

type App2View =
  | "athlete"
  | "trends"
  | "sport"
  | "recovery"
  | "sleep"
  | "session"
  | "coach"
  | "social"
  | "band";

type PlanItem = {
  time: string;
  title: string;
  load: string;
  color: "green" | "amber" | "red";
};

const dateLabel = new Date().toLocaleDateString([], {
  weekday: "long",
  month: "long",
  day: "numeric",
});

function Logo() {
  return (
    <div className="app2-logo">
      <img
        src="/vyro-logo.png"
        alt="VYRO"
        className="app2-logo-img"
        width={96}
        height={28}
        loading="eager"
      />
    </div>
  );
}

function Ring({ value }: { value: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, value)) / 100) * circumference;

  return (
    <div>
      <div className="app2-ring-wrap">
        <svg viewBox="0 0 104 104" role="img" aria-label={`Readiness ${value} out of 100`}>
          <circle
            cx="52"
            cy="52"
            r={radius}
            fill="none"
            stroke="hsl(0 0% 100% / 0.12)"
            strokeWidth="6"
          />
          <circle
            cx="52"
            cy="52"
            r={radius}
            fill="none"
            stroke="hsl(var(--app2-ready))"
            strokeLinecap="round"
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="app2-ring-num">
          <div>
            {value}
            <small>/ 100</small>
          </div>
        </div>
      </div>
      <div className="app2-ring-label">Readiness</div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  unit,
  trend,
  live,
}: {
  label: string;
  value: string | number;
  unit?: string;
  trend?: string;
  live?: boolean;
}) {
  return (
    <div className="app2-metric">
      <div className="app2-metric-label">
        <span>{label}</span>
        {live && <span style={{ color: "hsl(var(--app2-live))" }}>LIVE</span>}
      </div>
      <div className="app2-metric-value">
        {value}
        <span className="app2-metric-unit">{unit}</span>
      </div>
      {trend && <div className="app2-trend">↗ {trend}</div>}
    </div>
  );
}

function InfoCard({
  eyebrow,
  title,
  children,
  tone = "ready",
}: {
  eyebrow: string;
  title?: string;
  children: ReactNode;
  tone?: "ready" | "amber" | "live";
}) {
  const color =
    tone === "amber"
      ? "hsl(var(--app2-amber))"
      : tone === "live"
        ? "hsl(var(--app2-live))"
        : "hsl(var(--app2-ready))";

  return (
    <section className="app2-card app2-info-card">
      <div className="app2-eyebrow" style={{ color }}>
        {eyebrow}
      </div>
      {title && <h2 className="app2-card-title">{title}</h2>}
      <div>{children}</div>
    </section>
  );
}

function CognitiveFatigueCard({ m, baselineMs }: { m: LiveMetrics; baselineMs?: number }) {
  // Divergence = current reaction latency − personal baseline (median of recent samples).
  // If we have no baseline yet, show "calibrating".
  const { delay, status, vyroRead } = useMemo(() => {
    if (!m.connected || m.reactMin == null) {
      return { delay: "—", status: "Offline", vyroRead: "Awaiting band" };
    }
    if (baselineMs == null) {
      return { delay: `${Math.round(m.reactMin)}ms`, status: "Calibrating", vyroRead: "Building baseline" };
    }
    const diff = m.reactMin - baselineMs;
    const sign = diff >= 0 ? "+" : "−";
    const delay = `${sign}${Math.abs(Math.round(diff))}ms`;
    let status: string;
    let vyroRead: string;
    if (diff < 60) { status = "Normal"; vyroRead = "Sharp"; }
    else if (diff < 150) { status = "Slowing"; vyroRead = "Mild fatigue"; }
    else if (diff < 250) { status = "Elevated"; vyroRead = "Watch decision speed"; }
    else { status = "Diverged"; vyroRead = "Cognitively fried"; }
    return { delay, status, vyroRead };
  }, [m.connected, m.reactMin, baselineMs]);

  const hrStatus = useMemo(() => {
    if (!m.connected || m.heartRateBpm == null) return "—";
    if (m.heartRateBpm < 60) return "Low";
    if (m.heartRateBpm > 100) return "Elevated";
    return "Normal";
  }, [m.connected, m.heartRateBpm]);

  return (
    <section className="app2-card app2-info-card app2-cog-card">
      <div className="app2-cog-header">
        <div className="app2-cog-eyebrow">
          <Brain size={14} />
          <span>Cognitive load</span>
        </div>
        <span className="app2-cog-badge">{status.toUpperCase()}</span>
      </div>
      <h2 className="app2-card-title">Cognitive Fatigue Divergence</h2>
      <p className="app2-card-copy">
        Compares your live reaction latency against your personal baseline
        {baselineMs != null ? ` (${Math.round(baselineMs)}ms)` : ""} to flag mental fatigue before physical signs.
      </p>
      <div className="app2-cog-rows">
        <div className="app2-cog-row">
          <span className="app2-cog-row-label">Reaction divergence</span>
          <span className="app2-cog-row-value">{delay}</span>
        </div>
        <div className="app2-cog-row">
          <span className="app2-cog-row-label">Heart rate status</span>
          <span className="app2-cog-row-value">{hrStatus}</span>
        </div>
        <div className="app2-cog-row">
          <span className="app2-cog-row-label">VYRO read</span>
          <span className="app2-cog-row-value">{vyroRead}</span>
        </div>
      </div>
      <div className="app2-cog-insight">
        <Activity size={18} />
        <span>
          {m.connected && baselineMs != null
            ? "Divergence over 200ms = mental fatigue threshold. Best use case: returners, decision makers, late-game scenarios."
            : "Wear the band through a few rallies to seed the cognitive baseline."}
        </span>
      </div>
    </section>
  );
}


function EmbeddedView({
  view,
  profileSport,
}: {
  view: App2View;
  profileSport: "squash" | "tennis";
}) {
  if (view === "trends") {
    return (
      <div className="app2-scroll-embed">
        <TrendsView />
      </div>
    );
  }
  if (view === "session") {
    return (
      <div className="app2-scroll-embed">
        <SessionView />
      </div>
    );
  }
  if (view === "sport") {
    return (
      <div className="app2-scroll-embed">
        <SportView />
      </div>
    );
  }
  if (view === "recovery") {
    return (
      <div className="app2-scroll-embed">
        <RecoveryView />
      </div>
    );
  }
  if (view === "sleep") {
    return (
      <div className="app2-scroll-embed">
        <SleepView />
      </div>
    );
  }
  if (view === "coach") {
    return (
      <div className="app2-scroll-embed">
        <CoachView />
      </div>
    );
  }
  if (view === "social") {
    return (
      <div className="app2-scroll-embed">
        <SocialView />
      </div>
    );
  }
  if (view === "band") return <BandView defaultSport={profileSport} />;
  return null;
}

function BandView({ defaultSport }: { defaultSport: "squash" | "tennis" }) {
  const fetchProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
  });

  return (
    <div className="app2-scroll-embed">
      <BandPanel
        pairedId={profile?.paired_band_id ?? null}
        pairedName={profile?.paired_band_name ?? null}
        defaultSport={defaultSport}
      />
    </div>
  );
}

function AthleteHome({ setView }: { setView: (view: App2View) => void }) {
  const fetchProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
  });
  const m = useLiveMetrics();
  const firstName = (profile?.display_name || "Ryan").trim().split(/\s+/)[0] || "Ryan";
  const [items, setItems] = useState<PlanItem[]>([
    {
      time: "10:00",
      title: "Court session — interval ghosting",
      load: "Hard · 45 min",
      color: "amber",
    },
    {
      time: "13:30",
      title: "Match practice vs. Alex K.",
      load: "Match · ~50 min",
      color: "green",
    },
    {
      time: "19:00",
      title: "Mobility + breath work",
      load: "Recovery · 20 min",
      color: "green",
    },
  ]);
  const [draft, setDraft] = useState({
    time: "",
    title: "",
    load: "",
    color: "green" as PlanItem["color"],
  });

  const readinessInputs = computeReadiness({
    connected: m.connected,
    hrvMs: m.hrvMs,
    restingHrBpm: m.restingHrBpm,
    stress: m.stressScore,
    spo2: m.spo2Pct,
    peakJerk: m.peakJerk ?? null,
  });
  const subs = computeSubScores({
    connected: m.connected,
    hrvMs: m.hrvMs,
    restingHrBpm: m.restingHrBpm,
    stress: m.stressScore,
    peakJerk: m.peakJerk ?? null,
    peakG: m.peakG ?? null,
    eventsLastMin: m.eventsLastMin,
    reactMin: m.reactMin,
  });
  const readiness = readinessInputs.score ?? 78;
  const recovery = subs.recovery ?? 78;
  const sleep = subs.sleep ?? 87;
  const fatigue = subs.fatigue ?? 41;
  const agility = subs.agility ?? 88;
  const battery = m.batteryPct;
  const status = m.connected
    ? "BAND CONNECTED"
    : m.connecting
      ? "BAND CONNECTING"
      : "PAIR BAND";

  const vitals = useMemo(
    () => [
      {
        label: "Resting HR",
        value: m.restingHrBpm ?? "—",
        unit: "bpm",
        trend: m.restingHrBpm ? "baseline" : undefined,
        live: m.connected,
      },
      {
        label: "Current HR",
        value: m.heartRateBpm ?? "—",
        unit: "bpm",
        trend: m.heartRateBpm ? "live feed" : undefined,
        live: m.connected,
      },
      {
        label: "HRV (RMSSD)",
        value: m.hrvMs ?? "—",
        unit: "ms",
        trend: m.hrvMs ? "+8 ms" : undefined,
        live: m.connected,
      },
      {
        label: "SpO₂",
        value: m.spo2Pct ?? "—",
        unit: "%",
        trend: m.spo2Pct ? "stable" : undefined,
        live: m.connected,
      },
      {
        label: "Skin Temp",
        value: m.skinTempC?.toFixed(1) ?? "—",
        unit: "°C",
        trend: m.skinTempC ? "+0.1" : undefined,
        live: m.connected,
      },
      {
        label: "Steps",
        value: m.stepsToday?.toLocaleString() ?? "—",
        unit: "",
        trend: m.stepsToday ? "+18%" : undefined,
        live: m.connected,
      },
      {
        label: "Resp Rate",
        value: m.respRateBrpm?.toFixed(1) ?? "—",
        unit: "brpm",
        trend: m.respRateBrpm ? "steady" : undefined,
        live: m.connected,
      },
      {
        label: "Stress",
        value: m.stressScore ?? "—",
        unit: "/100",
        trend: m.stressScore != null ? "calm" : undefined,
        live: m.connected,
      },
    ],
    [
      m.connected,
      m.heartRateBpm,
      m.hrvMs,
      m.restingHrBpm,
      m.skinTempC,
      m.spo2Pct,
      m.stepsToday,
      m.respRateBrpm,
      m.stressScore,
    ],
  );

  const addPlan = () => {
    if (!draft.time.trim() && !draft.title.trim() && !draft.load.trim()) return;
    setItems((prev) => [
      ...prev,
      {
        time: draft.time || "TBD",
        title: draft.title || "New training block",
        load: draft.load || "Custom",
        color: draft.color,
      },
    ]);
    setDraft({ time: "", title: "", load: "", color: "green" });
  };

  return (
    <main className="app2-main">
      <div className="app2-date">
        <CalendarDays size={12} />
        {dateLabel}
      </div>
      <h1 className="app2-heading">Good morning, {firstName}.</h1>
      <p className="app2-subcopy">
        Your daily readiness command center — synced from your VYRO Band.
      </p>
      <button className="app2-live-pill" onClick={() => setView("band")}>
        <span className={m.connected ? "app2-dot app2-pulse" : "app2-dot"} />
        {status}
        {m.connected && battery != null ? ` · ${battery}%` : ""}
      </button>

      <section className="app2-card app2-readiness">
        <div className="app2-ring-box">
          <Ring value={readiness} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="app2-mini-row">
            <span className="app2-label-pill">Ready</span>
            <span className="app2-eyebrow">
              Recovery {recovery} · Sleep {sleep}
            </span>
          </div>
          <h2 className="app2-card-title">You're ready to train.</h2>
          <p className="app2-card-copy">
            Recovery is green and agility is sharp. Train hard, but protect the back-left corner.
          </p>
          <div className="app2-change-stack">
            <span className="app2-eyebrow">What changed</span>
            <span className="app2-change">↗ Recovery +6</span>
            <span className="app2-change">↗ HRV +8 ms</span>
            <span className="app2-change warn">⚠ Sleep debt 1h 24m</span>
          </div>
        </div>
      </section>

      <div className="app2-grid">
        <InfoCard eyebrow="Top opportunity">
          <p className="app2-card-copy">
            Agility is peaking (+10.5% over 12 sessions) — a good day to push interval ghosting.
          </p>
        </InfoCard>

        <InfoCard eyebrow="Base readiness" title="Core metrics">
          <div className="app2-metric-grid">
            <MiniMetric label="Fatigue" value={fatigue} unit="/100" trend="controlled" />
            <MiniMetric label="Recovery" value={recovery} unit="/100" trend="+6" />
            <MiniMetric label="Agility" value={agility} unit="/100" trend="+10.5%" />
            <MiniMetric label="Sleep" value={sleep} unit="/100" trend="+4" />
          </div>
        </InfoCard>

        <InfoCard eyebrow="Vitals" title="Live body signals" tone="live">
          <div className="app2-metric-grid">
            {vitals.map((vital) => (
              <MiniMetric key={vital.label} {...vital} />
            ))}
          </div>
        </InfoCard>

        <CognitiveFatigueCard m={m} />

        <InfoCard eyebrow="Return-to-play" title="RTP Validator" tone="amber">
          <p className="app2-card-copy">
            Clearance is on hold until wearable power and AI video symmetry return inside the 5%
            baseline.
          </p>
          <div className="app2-metric-grid">
            <MiniMetric label="Video symmetry" value="93" unit="/100" />
            <MiniMetric label="Wearable power" value="91" unit="/100" />
          </div>
        </InfoCard>

        <InfoCard eyebrow="Today's plan editable" title="Training blocks">
          <div style={{ marginTop: 10 }}>
            {items.map((item, index) => (
              <div className="app2-plan-row" key={`${item.time}-${index}`}>
                <div className="app2-plan-time">{item.time}</div>
                <div>
                  <div className="app2-plan-title">{item.title}</div>
                  <div className="app2-plan-sub">{item.load}</div>
                </div>
                <button
                  aria-label="Remove plan item"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                  style={{ color: "hsl(var(--app2-muted))" }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="app2-form-grid">
            <input
              className="app2-input"
              placeholder="Time"
              value={draft.time}
              onChange={(event) =>
                setDraft((current) => ({ ...current, time: event.target.value }))
              }
            />
            <input
              className="app2-input"
              placeholder="New plan item"
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.target.value }))
              }
            />
            <input
              className="app2-input"
              placeholder="Load"
              value={draft.load}
              onChange={(event) =>
                setDraft((current) => ({ ...current, load: event.target.value }))
              }
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 58px", gap: 8 }}>
              <select
                className="app2-select"
                value={draft.color}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    color: event.target.value as PlanItem["color"],
                  }))
                }
              >
                <option value="green">Optimal</option>
                <option value="amber">Elevated</option>
                <option value="red">High</option>
              </select>
              <button className="app2-add" onClick={addPlan}>
                <Plus size={15} />
              </button>
            </div>
          </div>
        </InfoCard>
      </div>
    </main>
  );
}

export function App2ReferenceShell() {
  const [view, setView] = useState<App2View>("athlete");
  const fetchProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
  });
  const m = useLiveMetrics();
  const sport = (profile?.sport as "squash" | "tennis" | undefined) ?? "squash";
  const initials =
    (profile?.display_name || "Ryan Carter")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "RC";
  const title = view === "trends" ? "Player Dashboard" : view === "athlete" ? "Athlete" : view[0].toUpperCase() + view.slice(1);
  const topButtons = [
    { id: "trends" as App2View, label: "Trends", icon: LineChart },
    { id: "session" as App2View, label: "Session", icon: Radio },
    { id: "coach" as App2View, label: "Coach", icon: UserRound },
    { id: "social" as App2View, label: "Social", icon: MessageCircle },
  ];
  const tabs = [
    { id: "athlete" as App2View, label: "Athlete", icon: Activity },
    { id: "sport" as App2View, label: "Sport", icon: Trophy },
    { id: "recovery" as App2View, label: "Recovery", icon: Heart },
    { id: "sleep" as App2View, label: "Sleep", icon: Moon },
  ];

  return (
    <div className="app2-ref">
      <div className="app2-phone">
        {/* Real iOS status bar shows through via safe-area inset; no fake status bar */}
        <header>
          <div className="app2-topbar">
            <div>
              <Logo />
              <div className="app2-kicker">VYRO IOS</div>
              <div className="app2-title">{title}</div>
            </div>
            <div>
              <div className="app2-actions">
                <button className="app2-sync" onClick={() => setView("band")}>
                  <span className={m.connected ? "app2-dot app2-pulse" : "app2-dot"} />
                  Sync now
                </button>
                <button
                  className="app2-icon-btn"
                  aria-label="Device settings"
                  onClick={() => setView("band")}
                >
                  <Settings2 size={17} />
                </button>
                <button className="app2-icon-btn" aria-label="Notifications">
                  <Bell size={17} />
                  <span className="app2-badge">2</span>
                </button>
              </div>
              <button className="app2-avatar" onClick={() => setView("band")}>
                {initials}
              </button>
            </div>
          </div>
          <nav className="app2-module-nav" aria-label="VYRO modules">
            {topButtons.map(({ id, label, icon: Icon }) => (
              <button key={label} className={`app2-chip ${view === id ? "active" : ""}`} onClick={() => setView(id)}>
                <Icon size={14} />
                {label}
              </button>
            ))}
          </nav>
        </header>

        {view === "athlete" ? (
          <AthleteHome setView={setView} />
        ) : (
          <main className="app2-main">
            <EmbeddedView view={view} profileSport={sport} />
          </main>
        )}

        <nav className="app2-bottom-nav" aria-label="Primary navigation">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`app2-tab ${view === id ? "active" : ""}`}
              onClick={() => setView(id)}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
