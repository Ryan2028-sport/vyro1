import { useState } from "react";
import { Activity, CircleHelp, Crosshair, Gauge, Grid2X2, Sparkles, Zap, ChevronLeft } from "lucide-react";
import { Card, EmptyState, PageHeader, Pill, Stat } from "./shared";
import { SPORT_PROFILES, type PerformanceGroup, type SportProfile } from "./sportProfiles";

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

type RouteRead = (typeof SQUASH_ROUTES)[number];

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
          <Card eyebrow="Performance groups">
            <h3 className="mb-4 text-[22px] font-black leading-tight text-vyro-text">Six lenses on {sport.label.toLowerCase()}.</h3>
            <div className="grid grid-cols-2 gap-3">
              {(sport.performanceGroups ?? sport.agilityComponents.map((a) => ({
                label: a.label,
                status: a.value >= 80 ? "Elite band" : "On target",
                value: a.value,
                metrics: [{ label: a.detail, value: a.value }],
              }))).map((group) => (
                <PerformanceGroupTile key={group.label} group={group} />
              ))}
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-vyro-mute">Court positioning is backed by full heat maps and opponent scouting in the Court DB tab.</p>
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
        isCourtSport ? <CourtDatabaseModule sport={sport} /> : (
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
        <>
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
        </>
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
          </Card>
        </>
      )}

      {tab === "motion" && (
        <>
          <Card eyebrow={sport.motionTitle} title="Frame-by-frame mechanics" action={<Pill tone="live">{sport.framePill}</Pill>}>
            <p className="text-[12px] text-vyro-mute mb-3">{sport.motionSubtitle}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {sport.contactGrid.map((c) => (
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
    <div className="min-h-[154px] rounded-2xl border border-vyro-line bg-vyro-elev p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-vyro-text/10 text-vyro-text">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 text-[15px] font-black leading-tight text-vyro-text">{group.label}</div>
          <CircleHelp className="h-3.5 w-3.5 shrink-0 text-vyro-mute" />
        </div>
        <span className="shrink-0 text-[22px] font-black leading-none tabular-nums text-vyro-text">{group.value}</span>
      </div>

      <div className="mt-7 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-vyro-mint">
        <span className="h-2 w-2 rounded-full bg-vyro-mint" />
        {group.status}
      </div>

      <div className="mt-5 space-y-3">
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

function CourtHeatMap({ sport }: { sport: SportProfile }) {
  const zones = sport.movementItems.slice(0, 6);
  return (
    <Card eyebrow="Live court heat map" title="Movement density" action={<Pill>Front wall ↑</Pill>}>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {[
          "Movement density",
          "Fatigue cost",
          "Attack conversion",
        ].map((label, index) => (
          <div
            key={label}
            className={`rounded-full border px-2 py-2 text-center text-[10px] font-bold leading-tight ${
              index === 0 ? "border-vyro-mint bg-vyro-mint/10 text-vyro-text" : "border-vyro-line bg-vyro-elev text-vyro-mute"
            }`}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {zones.map((zone, index) => (
          <div key={zone.name} className="rounded-xl border border-vyro-line bg-vyro-elev p-3">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-mute">Zone {index + 1}</div>
            <div className="mt-1 text-sm font-bold text-vyro-text">{zone.name}</div>
            <div className="mt-0.5 text-[11px] text-vyro-mute">{zone.detail}</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-vyro-line">
              <div className="h-full bg-vyro-mint" style={{ width: `${zone.value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
