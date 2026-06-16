import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { BandPanel } from "./BandPanel";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Save } from "lucide-react";
import { Card, PageHeader, Pill, Stat } from "./shared";

type Privacy = "private" | "team" | "coach" | "public";
type DataSharing = "private" | "coach_approved" | "team_aggregate";
type Theme = "system" | "vyro_dark" | "vyro_light" | "high_contrast";
type MetricDetail = "expanded" | "compact" | "coach" | "beginner";

export function ProfileView() {
  const fetchProfile = useServerFn(getMyProfile);
  const updateProfile = useServerFn(updateMyProfile);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
  });

  const [name, setName] = useState("");
  const [sport, setSport] = useState<"squash" | "tennis">("squash");
  const [hand, setHand] = useState<"left" | "right">("right");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Athlete identity (client-only until profile schema extends)
  const [school, setSchool] = useState("Yale Squash · 2026");
  const [coach, setCoach] = useState("Coach Shiv");
  const [position, setPosition] = useState("Mid-Atlantic baseliner");
  const [emergency, setEmergency] = useState("");
  const [injuryNotes, setInjuryNotes] = useState("");

  // Settings
  const [privacy, setPrivacy] = useState<Privacy>("team");
  const [sharing, setSharing] = useState<DataSharing>("coach_approved");
  const [scoutPublic, setScoutPublic] = useState(true);
  const [theme, setTheme] = useState<Theme>("vyro_dark");
  const [metricDetail, setMetricDetail] = useState<MetricDetail>("expanded");
  const [coachVisibility, setCoachVisibility] = useState<Privacy>("team");

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name ?? "");
    setSport((profile.sport as "squash" | "tennis") ?? "squash");
    setHand((profile.handedness as "left" | "right") ?? "right");
  }, [profile]);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await updateProfile({ data: { display_name: name, sport, handedness: hand } });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading) return <div className="p-6 text-sm text-vyro-mute">Loading profile…</div>;

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Account · scout profile" title={name || "Your profile"} subtitle="Identity, sport, settings, and the band you're paired with." />

      <Card eyebrow="Identity" title="Personal info">
        <Field label="Display name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-vyro-line bg-vyro-panel px-3 py-2.5 text-sm text-vyro-text outline-none focus:border-vyro-text/40"
          />
        </Field>
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Primary sport">
            <div className="flex gap-1.5">
              {(["squash", "tennis"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSport(s)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${
                    sport === s ? "border-vyro-mint bg-vyro-mint text-vyro-ink" : "border-vyro-line bg-vyro-panel text-vyro-mute"
                  }`}
                >{s}</button>
              ))}
            </div>
          </Field>
          <Field label="Handedness">
            <div className="flex gap-1.5">
              {(["left", "right"] as const).map((h) => (
                <button
                  key={h}
                  onClick={() => setHand(h)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${
                    hand === h ? "border-vyro-mint bg-vyro-mint text-vyro-ink" : "border-vyro-line bg-vyro-panel text-vyro-mute"
                  }`}
                >{h}</button>
              ))}
            </div>
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-vyro-mint px-4 py-2.5 text-sm font-bold text-vyro-ink hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? "Saving…" : saved ? "Saved" : "Save"}
          </button>
          <button
            onClick={signOut}
            className="ml-auto flex items-center gap-2 rounded-xl border border-vyro-line bg-vyro-panel px-3 py-2 text-xs font-semibold text-vyro-mute"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </Card>

      <Card eyebrow="Public athlete identity" title="School + team">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="School / team">
            <input value={school} onChange={(e) => setSchool(e.target.value)} className="w-full rounded-xl border border-vyro-line bg-vyro-panel px-3 py-2 text-sm text-vyro-text outline-none focus:border-vyro-text/40" />
          </Field>
          <Field label="Coach">
            <input value={coach} onChange={(e) => setCoach(e.target.value)} className="w-full rounded-xl border border-vyro-line bg-vyro-panel px-3 py-2 text-sm text-vyro-text outline-none focus:border-vyro-text/40" />
          </Field>
          <Field label="Position / style">
            <input value={position} onChange={(e) => setPosition(e.target.value)} className="w-full rounded-xl border border-vyro-line bg-vyro-panel px-3 py-2 text-sm text-vyro-text outline-none focus:border-vyro-text/40" />
          </Field>
        </div>
      </Card>

      <Card eyebrow="Public scout profile" title="Recruiter view">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Recruiter grade" value="A−" />
          <Stat label="Global percentile" value="87" unit="pct" />
          <Stat label="Reliability" value="High" />
          <Stat label="Verified sessions" value="—" />
          <Stat label="Avg recovery" value="—" unit="%" />
          <Stat label="Avg sleep" value="—" unit="/100" />
        </div>
        <p className="mt-3 rounded-xl border border-vyro-line bg-vyro-elev p-3 text-[12px] text-vyro-mute">
          <span className="font-mono text-[9px] uppercase tracking-wider text-vyro-text">Coach note · </span>
          Average metric breakdown and heat-map movement are shared in the recruiting / coach packet.
        </p>
        <label className="mt-3 flex items-center gap-2 text-[12px] text-vyro-text">
          <input type="checkbox" checked={scoutPublic} onChange={(e) => setScoutPublic(e.target.checked)} className="h-4 w-4 accent-[var(--vyro-mint)]" />
          Public scout profile enabled
        </label>
      </Card>

      <Card eyebrow="Safety + privacy" title="Coach access, emergency contact, prototype notes">
        <Field label="Privacy mode">
          <Select value={privacy} onChange={(v) => setPrivacy(v as Privacy)} options={[
            ["private", "Private"], ["team", "Team + coach"], ["coach", "Coach only"], ["public", "Public scout profile"],
          ]} />
        </Field>
        <Field label="Data sharing">
          <Select value={sharing} onChange={(v) => setSharing(v as DataSharing)} options={[
            ["private", "Private only"], ["coach_approved", "Coach approved"], ["team_aggregate", "Team aggregate"],
          ]} />
        </Field>
        <Field label="Coach visibility">
          <Select value={coachVisibility} onChange={(v) => setCoachVisibility(v as Privacy)} options={[
            ["private", "Private"], ["team", "Team + coach"], ["coach", "Coach only"], ["public", "Public scout profile"],
          ]} />
        </Field>
        <Field label="Emergency contact">
          <input value={emergency} onChange={(e) => setEmergency(e.target.value)} placeholder="Name · phone" className="w-full rounded-xl border border-vyro-line bg-vyro-panel px-3 py-2 text-sm text-vyro-text outline-none focus:border-vyro-text/40" />
        </Field>
        <Field label="Injury / medical notes">
          <textarea value={injuryNotes} onChange={(e) => setInjuryNotes(e.target.value)} rows={3} className="w-full rounded-xl border border-vyro-line bg-vyro-panel px-3 py-2 text-sm text-vyro-text outline-none focus:border-vyro-text/40" />
        </Field>
      </Card>

      <Card eyebrow="App settings" title="Display + defaults">
        <Field label="Theme preference">
          <Select value={theme} onChange={(v) => setTheme(v as Theme)} options={[
            ["system", "System"], ["vyro_dark", "VYRO dark"], ["vyro_light", "VYRO light"], ["high_contrast", "High contrast"],
          ]} />
        </Field>
        <Field label="Metric detail default">
          <Select value={metricDetail} onChange={(v) => setMetricDetail(v as MetricDetail)} options={[
            ["expanded", "Expanded on tap"], ["compact", "Compact"], ["coach", "Coach-level detail"], ["beginner", "Beginner explanations"],
          ]} />
        </Field>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Pill tone="live">Auto + manual sessions</Pill>
          <Pill tone="neutral">Recovery + battery</Pill>
          <Pill tone="neutral">CSV + PDF export</Pill>
        </div>
      </Card>

      <BandPanel
        pairedId={profile?.paired_band_id ?? null}
        pairedName={profile?.paired_band_name ?? null}
        defaultSport={sport}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[11px] font-semibold text-vyro-mute">{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-vyro-line bg-vyro-panel px-3 py-2 text-sm text-vyro-text outline-none focus:border-vyro-text/40"
    >
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
