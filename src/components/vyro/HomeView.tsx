import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, ChevronRight, TrendingUp } from "lucide-react";
import { getMyProfile } from "@/lib/profile.functions";
import { Card, EmptyState, PageHeader, Pill, Ring, Stat } from "./shared";
import { recoveryBand, useLiveMetrics } from "./useLiveMetrics";
import type { ViewId } from "./Layout";
import { FEATURE_SPECS } from "./featureSpecs";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const SHORTCUTS: { id: ViewId; label: string }[] = [
  { id: "trends", label: "Trends" },
  { id: "session", label: "Session" },
  { id: "coach", label: "Coach" },
  { id: "social", label: "Social" },
];

export function HomeView({ setView }: { setView: (v: ViewId) => void }) {
  const fetchProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const first = (profile?.display_name || "").trim().split(/\s+/)[0] || "Athlete";

  const m = useLiveMetrics();
  const recoveryScore: number | null = null; // wired when HRV/RHR/sleep land
  const band = recoveryBand(recoveryScore);
  const bandTone = band === "green" ? "live" : band === "red" ? "off" : "warn";
  const bandLabel =
    band === "green" ? "READY" : band === "red" ? "NOT READY" : band === "yellow" ? "CAUTION" : "PENDING";

  const todayLabel = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const connectionPill = !m.connected
    ? <Pill tone="off">Band offline</Pill>
    : <Pill tone="live" pulse>Band connected · 94%</Pill>;

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-vyro-mute">VYRO OS</div>
        <h1 className="mt-1 text-4xl font-black tracking-tight text-vyro-text">Athlete</h1>
      </div>

      {/* Shortcut chip row */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {SHORTCUTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setView(s.id)}
            className="shrink-0 rounded-full border border-vyro-line bg-vyro-panel px-3.5 py-1.5 text-xs font-semibold text-vyro-text/80 hover:border-vyro-mint/40 hover:text-vyro-mint"
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="border-t border-vyro-line pt-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-vyro-mute">{todayLabel}</div>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-vyro-text">{greeting()}, {first}.</h2>
        <p className="mt-1 text-xs leading-relaxed text-vyro-mute">
          Your daily readiness command center — synced from your VYRO band.
        </p>
        <div className="mt-3">{connectionPill}</div>
      </div>

      {/* READINESS HERO */}
      <button
        onClick={() => setView("recovery")}
        className="w-full rounded-2xl border border-vyro-line bg-vyro-panel p-4 text-left shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] hover:border-vyro-mint/40"
      >
        <div className="flex items-start gap-4">
          <Ring value={recoveryScore} label="Readiness" sub="/100" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <Pill tone={bandTone} pulse={band === "green"}>{bandLabel}</Pill>
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-mute">
                Recovery — · Sleep —
              </span>
            </div>
            <p className="mt-3 text-lg font-black leading-tight text-vyro-text">
              {recoveryScore == null
                ? "Waiting on overnight data."
                : recoveryScore >= 67
                  ? "You're ready to train."
                  : recoveryScore >= 34
                    ? "Train with caution."
                    : "Prioritize recovery."}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-vyro-mute">
              Recovery streams live from HR, HRV, load and sleep. Tap to open the full readiness console.
            </p>
          </div>
        </div>

        <div className="mt-4 border-t border-vyro-line pt-3">
          <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute">What changed</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-vyro-mint/30 bg-vyro-mint/10 px-2.5 py-1 text-[11px] font-semibold text-vyro-mint">
              <TrendingUp className="h-3 w-3" /> Recovery —
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-vyro-mint/30 bg-vyro-mint/10 px-2.5 py-1 text-[11px] font-semibold text-vyro-mint">
              <TrendingUp className="h-3 w-3" /> HRV —
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-vyro-amber/30 bg-vyro-amber/10 px-2.5 py-1 text-[11px] font-semibold text-vyro-amber">
              <ArrowUpRight className="h-3 w-3" /> Sleep debt —
            </span>
          </div>
        </div>
      </button>

      <Card eyebrow="Today · top opportunity" title="Train smart">
        <p className="text-xs leading-relaxed text-vyro-mute">
          Once HRV and sleep stream from the band, your top opportunity for the day shows here —
          which zone to push, which to protect, and the rally pattern to drill.
        </p>
      </Card>

      <Card eyebrow="Athlete · 24/7" title="Health right now" action={
        <button onClick={() => setView("athlete")} className="text-[11px] font-semibold text-vyro-mint hover:underline">View all</button>
      }>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Current HR" value="—" unit="bpm" />
          <Stat label="HRV" value="—" unit="ms" />
          <Stat label="SpO₂" value="—" unit="%" />
          <Stat label="Skin temp" value="—" unit="°C" />
          <Stat label="Resp rate" value="—" unit="br/min" />
          <Stat label="Steps" value="—" />
          <Stat label="Active kcal" value="—" />
          <Stat label="Stress" value="—" />
        </div>
      </Card>

      <Card eyebrow="Session" title={m.sessionState === "live" ? "Session is live" : "Start a session"}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="State" value={m.sessionState} />
          <Stat label="Swings" value={m.connected ? m.counts.swing : "—"} />
          <Stat label="Events/min" value={m.connected ? m.eventsLastMin : "—"} />
          <Stat label="Peak g" value={m.connected ? m.peakG.toFixed(2) : "—"} unit="g" />
        </div>
        <button
          onClick={() => setView("session")}
          className="mt-3 w-full rounded-xl bg-vyro-mint px-4 py-3 text-sm font-bold text-vyro-ink hover:bg-vyro-mint/85"
        >
          {m.sessionState === "live" ? "Open session console →" : "Start session →"}
        </button>
      </Card>

      {!m.pairedId && (
        <EmptyState
          title="No band paired"
          hint="Pair your VYRO band to stream live HR, motion and recovery."
          action={
            <button
              onClick={() => setView("profile")}
              className="rounded-full bg-vyro-mint px-4 py-2 text-xs font-semibold text-vyro-ink hover:bg-vyro-mint/85"
            >
              Pair your band
            </button>
          }
        />
      )}

      <Card eyebrow="Modules" title="All VYRO domains">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FEATURE_SPECS.map((spec) => {
            const Icon = spec.icon;
            return (
              <button
                key={spec.id}
                onClick={() => setView(spec.id)}
                className="group flex min-w-0 items-center gap-3 rounded-xl border border-vyro-line bg-vyro-elev p-3 text-left transition-colors hover:border-vyro-mint/40"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-vyro-line bg-vyro-panel text-vyro-mint">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-black text-vyro-text">{spec.label}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[10px] leading-snug text-vyro-mute">
                    {spec.blurb}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-vyro-mute group-hover:text-vyro-mint" />
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
