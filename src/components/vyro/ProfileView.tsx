import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { BandPanel } from "./BandPanel";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Save } from "lucide-react";

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

  if (isLoading) return <div className="p-6 text-sm text-white/55">Loading profile…</div>;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">Profile</div>
        <h2 className="mt-1 mb-4 text-2xl font-black">{name || "Your account"}</h2>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-white/55">Display name</span>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-sm outline-none focus:border-white/40" />
        </label>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <label>
            <span className="mb-1 block text-xs text-white/55">Primary sport</span>
            <div className="flex gap-1.5">
              {(["squash", "tennis"] as const).map((s) => (
                <button key={s} onClick={() => setSport(s)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${sport === s ? "border-white/40 bg-white/[0.18]" : "border-white/15 bg-white/[0.04] text-white/60"}`}>{s}</button>
              ))}
            </div>
          </label>
          <label>
            <span className="mb-1 block text-xs text-white/55">Handedness</span>
            <div className="flex gap-1.5">
              {(["left", "right"] as const).map((h) => (
                <button key={h} onClick={() => setHand(h)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${hand === h ? "border-white/40 bg-white/[0.18]" : "border-white/15 bg-white/[0.04] text-white/60"}`}>{h}</button>
              ))}
            </div>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? "Saving…" : saved ? "Saved" : "Save"}
          </button>
          <button onClick={signOut}
            className="ml-auto flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-xs text-white/70 hover:bg-white/[0.1]">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>

      <BandPanel
        pairedId={profile?.paired_band_id ?? null}
        pairedName={profile?.paired_band_name ?? null}
        defaultSport={sport}
      />
    </div>
  );
}
