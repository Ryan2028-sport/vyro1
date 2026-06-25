import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { BandPanel } from "./BandPanel";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import {
  LogOut,
  Save,
  Bug,
  Bell,
  Shield,
  Palette,
  User,
  Watch,
  ChevronRight,
  Moon,
  Smartphone,
  Globe,
  FileText,
  HelpCircle,
  Trash2,
} from "lucide-react";
import { Card, PageHeader } from "./shared";

type Privacy = "private" | "team" | "coach" | "public";
type Theme = "system" | "light" | "dark";
type Units = "metric" | "imperial";

export function ProfileView({ onNavigate }: { onNavigate?: (view: string) => void }) {
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

  const [privacy, setPrivacy] = useState<Privacy>("team");
  const [theme, setTheme] = useState<Theme>("light");
  const [units, setUnits] = useState<Units>("metric");
  const [notifications, setNotifications] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const [autoRecord, setAutoRecord] = useState(true);

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
    navigate({ to: "/onboarding", replace: true });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Settings" title="Profile & Settings" subtitle="Manage your account, band, and app preferences." />

      {/* Profile Card */}
      <Card>
        <div className="flex items-center gap-4 pb-4">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-gray-100 text-lg font-bold text-gray-600">
            {name ? name.slice(0, 2).toUpperCase() : "?"}
          </div>
          <div className="flex-1">
            <div className="text-base font-bold text-gray-900">{name || "Set your name"}</div>
            <div className="font-mono text-[11px] text-gray-400 capitalize">{sport} · {hand}-handed</div>
          </div>
        </div>
        <div className="space-y-3 border-t border-gray-100 pt-4">
          <Field label="Display name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Primary sport">
              <div className="flex gap-1.5">
                {(["squash", "tennis"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSport(s)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                      sport === s
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
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
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                      hand === h
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                    }`}
                  >{h}</button>
                ))}
              </div>
            </Field>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
          </button>
        </div>
      </Card>

      {/* Band */}
      <BandPanel
        pairedId={profile?.paired_band_id ?? null}
        pairedName={profile?.paired_band_name ?? null}
        defaultSport={sport}
      />

      {/* App Preferences */}
      <Card>
        <SectionTitle icon={Palette} title="Appearance" />
        <SettingRow label="Theme" description="App color scheme">
          <SegmentedControl
            value={theme}
            onChange={(v) => setTheme(v as Theme)}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "Auto" },
            ]}
          />
        </SettingRow>
        <SettingRow label="Units" description="Distance and weight">
          <SegmentedControl
            value={units}
            onChange={(v) => setUnits(v as Units)}
            options={[
              { value: "metric", label: "Metric" },
              { value: "imperial", label: "Imperial" },
            ]}
          />
        </SettingRow>
      </Card>

      {/* Notifications & Recording */}
      <Card>
        <SectionTitle icon={Bell} title="Notifications & Sessions" />
        <ToggleRow
          label="Push notifications"
          description="Recovery alerts, session summaries, coach messages"
          checked={notifications}
          onChange={setNotifications}
        />
        <ToggleRow
          label="Haptic feedback"
          description="Vibration on session start/end"
          checked={haptics}
          onChange={setHaptics}
        />
        <ToggleRow
          label="Auto-record sessions"
          description="Start recording when band detects activity"
          checked={autoRecord}
          onChange={setAutoRecord}
        />
      </Card>

      {/* Privacy */}
      <Card>
        <SectionTitle icon={Shield} title="Privacy & Sharing" />
        <SettingRow label="Profile visibility" description="Who can see your stats">
          <select
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value as Privacy)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none"
          >
            <option value="private">Private</option>
            <option value="coach">Coach only</option>
            <option value="team">Team + coach</option>
            <option value="public">Public</option>
          </select>
        </SettingRow>
      </Card>

      {/* Developer */}
      <Card>
        <SectionTitle icon={Bug} title="Developer" />
        <LinkRow
          label="BLE Debug Inspector"
          description="Raw BLE traffic, GATT services, notify counts"
          onClick={() => onNavigate?.("debug")}
        />
        <LinkRow
          label="Export session data"
          description="Download CSV of all recorded sessions"
          onClick={() => {}}
        />
      </Card>

      {/* Support & Legal */}
      <Card>
        <SectionTitle icon={HelpCircle} title="Support" />
        <LinkRow label="Help center" description="FAQs and troubleshooting" onClick={() => {}} />
        <LinkRow label="Privacy policy" description="How we handle your data" onClick={() => {}} />
        <LinkRow label="Terms of service" description="Legal agreements" onClick={() => {}} />
        <div className="mt-2 text-center font-mono text-[10px] text-gray-300">VYRO v0.1.0 · build 1</div>
      </Card>

      {/* Sign Out & Danger Zone */}
      <Card>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
        <button
          className="mt-3 flex w-full items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-500 transition-colors hover:bg-red-100"
          onClick={() => {}}
        >
          <Trash2 className="h-4 w-4" /> Delete account
        </button>
      </Card>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof User; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-gray-400" />
      <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{title}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[11px] font-semibold text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-gray-100 py-3 first:border-t-0 first:pt-0">
      <div>
        <div className="text-sm font-medium text-gray-900">{label}</div>
        {description && <div className="text-[11px] text-gray-400">{description}</div>}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-gray-100 py-3 first:border-t-0 first:pt-0">
      <div>
        <div className="text-sm font-medium text-gray-900">{label}</div>
        {description && <div className="text-[11px] text-gray-400">{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-gray-900" : "bg-gray-200"
        }`}
      >
        <div
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function LinkRow({
  label,
  description,
  onClick,
}: {
  label: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 border-t border-gray-100 py-3 text-left first:border-t-0 first:pt-0"
    >
      <div>
        <div className="text-sm font-medium text-gray-900">{label}</div>
        {description && <div className="text-[11px] text-gray-400">{description}</div>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
    </button>
  );
}

function SegmentedControl({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            value === opt.value
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
