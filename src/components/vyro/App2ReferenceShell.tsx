import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Bell,
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
import { computeReadiness, computeSubScores, useLiveMetrics } from "./useLiveMetrics";
import "./app2-reference.css";

type App2View =
  | "athlete"
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
    <svg className="app2-logo-mark" viewBox="0 0 128 70" aria-label="VYRO">
      <path
        d="M8 28h26l8-18 11 40 10-30 8 8h49"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <text x="0" y="58" fill="currentColor" fontSize="19" fontWeight="900" letterSpacing="13">
        VYRO
      </text>
      <text
        x="18"
        y="68"
        fill="currentColor"
        opacity=".62"
        fontSize="6"
        fontWeight="700"
        letterSpacing="6"
      >
        OWN THE EDGE
      </text>
    </svg>
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

function EmbeddedView({
  view,
  profileSport,
}: {
  view: App2View;
  profileSport: "squash" | "tennis";
}) {
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
    peakJerk: m.peakJerk || null,
  });
  const subs = computeSubScores({
    connected: m.connected,
    hrvMs: m.hrvMs,
    restingHrBpm: m.restingHrBpm,
    stress: m.stressScore,
    peakJerk: m.peakJerk || null,
    peakG: m.peakG || null,
    eventsLastMin: m.eventsLastMin,
    reactMin: m.reactMin,
  });
  const readiness = readinessInputs.score ?? 78;
  const recovery = subs.recovery ?? 78;
  const sleep = subs.sleep ?? 87;
  const fatigue = subs.fatigue ?? 41;
  const agility = subs.agility ?? 88;
  const battery = m.batteryPct ?? 94;
  const status = m.connected
    ? "BAND CONNECTED"
    : m.connecting
      ? "BAND CONNECTING"
      : m.pairedId
        ? "BAND PAIRED"
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
    ],
    [m.connected, m.heartRateBpm, m.hrvMs, m.restingHrBpm, m.skinTempC, m.spo2Pct, m.stepsToday],
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
        {status} · {battery}%
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
  const title = view === "athlete" ? "Athlete" : view[0].toUpperCase() + view.slice(1);
  const topButtons = [
    { id: "athlete" as App2View, label: "Trends", icon: LineChart },
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
        <div className="app2-status">
          <span>9:41</span>
          <span>LTE · {m.batteryPct ?? 94}%</span>
        </div>
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
              <button key={label} className="app2-chip" onClick={() => setView(id)}>
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
