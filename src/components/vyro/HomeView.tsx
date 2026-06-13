import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight } from "lucide-react";
import { getMyProfile } from "@/lib/profile.functions";
import { Card, EmptyState, PageHeader, Pill, Stat } from "./shared";
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

// Home dashboard — Athlete top-line. Live IMU streams from the band today;
// HR / HRV / sleep / recovery render "—" until the firmware emits those
// characteristics. Layout mirrors the VYRO spec so we wire one line per
// metric as each characteristic lands.
export function HomeView({ setView }: { setView: (v: ViewId) => void }) {
  const fetchProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const first = (profile?.display_name || "").trim().split(/\s+/)[0] || "Athlete";

  const m = useLiveMetrics();
  const recoveryScore: number | null = null;
  const band = recoveryBand(recoveryScore);
  const bandTone = band === "green" ? "live" : band === "red" ? "off" : "warn";
  const bandLabel =
    band === "green" ? "READY" : band === "red" ? "NOT READY" : band === "yellow" ? "CAUTION" : "PENDING";

  const statusTone = !m.connected ? (m.connecting ? "warn" : "off") : m.sessionState === "live" ? "live" : "warn";
  const statusText = !m.connected
    ? (m.connecting ? "Connecting…" : "Watch offline")
    : m.sessionState === "live" ? "Live session" : "Connected · idle";

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <PageHeader
        eyebrow="Athlete dashboard"
        title={`${greeting()}, ${first}.`}
        subtitle="Live VYRO band metrics. 24/7 health up top, sport metrics light up during sessions."
        action={<Pill tone={statusTone} pulse={m.sessionState === "live"}>{statusText}</Pill>}
      />

      {/* LIVE RECOVERY HERO */}
      <button
        onClick={() => setView("recovery")}
        className="w-full rounded-2xl border border-vyro-text/[0.07] bg-vyro-panel p-4 text-left shadow-[0_1px_0_rgba(0,0,0,0.03)] hover:border-vyro-text/20"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-text/45">LIVE recovery</div>
          <Pill tone={bandTone} pulse={band === "green"}>{bandLabel}</Pill>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-black tabular-nums text-vyro-text">
            {recoveryScore == null ? "—" : `${recoveryScore}`}
          </span>
          <span className="text-sm font-bold text-vyro-text/45">%</span>
          <span className="ml-auto inline-flex items-center text-xs font-semibold text-vyro-text/55">
            Recovery details <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-vyro-text/55">
          HR · HRV · load · sleep · skin temp. Updates every second while the band is worn.
        </p>
      </button>

      {/* ATHLETE TOP-LINE */}
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

      {/* SESSION QUICK CTA */}
      <Card eyebrow="Session" title={m.sessionState === "live" ? "Session is live" : "Start a session"}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Session state" value={m.sessionState} />
          <Stat label="Swings" value={m.connected ? m.counts.swing : "—"} />
          <Stat label="Events / min" value={m.connected ? m.eventsLastMin : "—"} />
          <Stat label="Peak accel" value={m.connected ? m.peakG.toFixed(2) : "—"} unit="g" />
        </div>
        <button
          onClick={() => setView("session")}
          className="mt-3 w-full rounded-xl bg-vyro-mint px-4 py-3 text-sm font-bold text-white hover:bg-vyro-mint/85"
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
              className="rounded-full bg-vyro-mint px-4 py-2 text-xs font-semibold text-white hover:bg-vyro-text/85"
            >
              Pair your band
            </button>
          }
        />
      )}

      {/* MODULE GRID */}
      <Card eyebrow="Modules" title="All VYRO domains">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FEATURE_SPECS.map((spec) => {
            const Icon = spec.icon;
            return (
              <button
                key={spec.id}
                onClick={() => setView(spec.id)}
                className="group flex min-w-0 items-center gap-3 rounded-xl border border-vyro-text/[0.06] bg-vyro-text/[0.02] p-3 text-left transition-colors hover:border-vyro-text/20 hover:bg-vyro-text/[0.04]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-vyro-panel text-vyro-text shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-black text-vyro-text">{spec.label}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[10px] leading-snug text-vyro-text/55">
                    {spec.blurb}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-vyro-text/30 group-hover:text-vyro-text/65" />
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
