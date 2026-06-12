import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/profile.functions";
import { VyroBandProvider, useVyroBandCtx } from "@/components/vyro/VyroBandProvider";
import { ProfileView } from "@/components/vyro/ProfileView";

export const Route = createFileRoute("/_authenticated/app")({
  component: () => (
    <VyroBandProvider>
      <AppPage />
    </VyroBandProvider>
  ),
});

function AppPage() {
  const [showProfile, setShowProfile] = useState(false);
  const [showLive, setShowLive] = useState(true);

  const fetchProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const displayName = (profile?.display_name || "").trim();
  const iframeSrc = displayName
    ? `/vyro-app.html?name=${encodeURIComponent(displayName)}`
    : "/vyro-app.html";

  return (
    <div className="relative h-svh w-svw bg-white">
      <iframe
        key={iframeSrc}
        src={iframeSrc}
        title="VYRO"
        className="absolute inset-0 h-full w-full border-0"
      />


      {/* Top-right controls */}
      <div className="absolute top-3 right-3 z-50 flex gap-2">
        <button
          onClick={() => setShowLive((v) => !v)}
          className="rounded-full bg-black/85 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur hover:bg-black"
        >
          {showLive ? "Hide live panel" : "Show live panel"}
        </button>
        <button
          onClick={() => setShowProfile(true)}
          className="rounded-full bg-black/85 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur hover:bg-black"
        >
          Profile & Band
        </button>
      </div>

      {showLive && <LiveOverlay />}

      {showProfile && (
        <div className="absolute inset-0 z-40 overflow-auto bg-gradient-to-b from-slate-950 to-slate-900 p-4 text-white">
          <button
            onClick={() => setShowProfile(false)}
            className="mb-4 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
          >
            ← Back to app
          </button>
          <ProfileView />
        </div>
      )}
    </div>
  );
}

function LiveOverlay() {
  const { ble, events, counts, connected, sessionState } = useVyroBandCtx();
  const connecting = ble.connectionState === "connecting";

  const live = useMemo(() => {
    let peakG = 0, peakDps = 0, peakJerk = 0;
    let swingInt = 0, swingDurMax = 0, reactMin = Infinity;
    const cutoff = Date.now() - 60_000;
    let eventsLastMin = 0;
    for (const e of events) {
      if (e.ts >= cutoff) eventsLastMin++;
      const ev = e.event as any;
      if (ev.accelPeakG?.value != null) peakG = Math.max(peakG, ev.accelPeakG.value);
      if (ev.gyroPeakDps?.value != null) peakDps = Math.max(peakDps, ev.gyroPeakDps.value);
      if (ev.jerkPeakGps?.value != null) peakJerk = Math.max(peakJerk, ev.jerkPeakGps.value);
      if (ev.type === "swing") {
        if (typeof ev.intensity === "number") swingInt = Math.max(swingInt, ev.intensity);
        if (typeof ev.durationMs === "number") swingDurMax = Math.max(swingDurMax, ev.durationMs);
      }
      if (ev.type === "direction_change" && typeof ev.gapMs === "number") {
        reactMin = Math.min(reactMin, ev.gapMs);
      }
    }
    return {
      peakG, peakDps, peakJerk, swingInt, swingDurMax,
      reactMin: reactMin === Infinity ? null : reactMin,
      eventsLastMin,
    };
  }, [events]);

  const status = !connected
    ? (connecting ? "CONNECTING…" : "OFFLINE — no live data")
    : sessionState === "live" ? "LIVE SESSION" : "CONNECTED · idle";
  const statusColor = !connected
    ? "bg-rose-500"
    : sessionState === "live" ? "bg-emerald-500 animate-pulse" : "bg-amber-400";

  // Show "—" when not connected, real numbers when connected
  const fmt = (n: number | null, digits = 0, unit = "") =>
    !connected || n == null ? "—" : `${n.toFixed(digits)}${unit}`;

  const tiles = [
    { label: "Swings", value: connected ? String(counts.swing) : "—" },
    { label: "Rapid starts", value: connected ? String(counts.rapid_start) : "—" },
    { label: "Bursts", value: connected ? String(counts.burst) : "—" },
    { label: "Dir Δ", value: connected ? String(counts.direction_change) : "—" },
    { label: "Peak accel", value: fmt(live.peakG, 2, " g") },
    { label: "Peak gyro", value: fmt(live.peakDps, 0, " dps") },
    { label: "Peak jerk", value: fmt(live.peakJerk, 1, " g/s") },
    { label: "Swing intensity", value: fmt(live.swingInt, 0, " /100") },
    { label: "Swing duration", value: fmt(live.swingDurMax, 0, " ms") },
    { label: "Reaction gap", value: fmt(live.reactMin, 0, " ms") },
    { label: "Events / min", value: connected ? String(live.eventsLastMin) : "—" },
    { label: "Total events", value: connected ? String(events.length) : "—" },
  ];

  return (
    <div className="pointer-events-auto absolute left-3 right-3 bottom-20 z-40 max-w-[640px] mx-auto rounded-2xl border border-black/10 bg-white/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-2 w-2 rounded-full ${statusColor}`} />
        <span className="text-[11px] font-bold tracking-widest text-black/70">{status}</span>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-black/40">
          Real watch data only · no fake values
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg bg-black/[0.04] p-2">
            <div className="text-[9px] uppercase tracking-wider text-black/50">{t.label}</div>
            <div className="text-sm font-bold text-black tabular-nums">{t.value}</div>
          </div>
        ))}
      </div>
      {!connected && (
        <p className="mt-2 text-[10px] leading-snug text-black/55">
          The visual dashboard behind this panel is the static design template — its numbers are
          placeholder demo content. Pair your VYRO band from <b>Profile &amp; Band</b> and these
          tiles fill in live from the watch.
        </p>
      )}
    </div>
  );
}
