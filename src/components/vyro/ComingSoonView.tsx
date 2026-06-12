import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Radio } from "lucide-react";
import type { ReactNode } from "react";
import { Card, PageHeader, Pill, Stat } from "./shared";
import type { ViewId } from "./Layout";

export interface ComingSoonSpec {
  id: Exclude<ViewId, "home" | "session" | "history" | "profile" | "more">;
  label: string;
  eyebrow: string;
  icon: LucideIcon;
  blurb: string;
  // What the watch firmware needs to expose before this tab becomes real.
  needs: string[];
  // Sections the tab will eventually show.
  preview: { title: string; rows: { label: string; unit?: string; hint?: string }[] }[];
  // Optional callout (e.g. "Manual log is available below" — keep null for now)
  extra?: ReactNode;
}

export function ComingSoonView({
  spec,
  setView,
}: {
  spec: ComingSoonSpec;
  setView: (v: ViewId) => void;
}) {
  const Icon = spec.icon;
  return (
    <div>
      <button
        onClick={() => setView("more")}
        className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold text-black/70 hover:text-black"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      <PageHeader
        eyebrow={spec.eyebrow}
        title={spec.label}
        subtitle={spec.blurb}
        action={<Pill tone="warn">Coming soon</Pill>}
      />

      <Card
        eyebrow="Firmware status"
        title="Waiting on watch data"
        className="mb-4"
        action={
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-black/45">
            <Radio className="h-3 w-3" /> not streaming
          </span>
        }
      >
        <p className="text-xs leading-relaxed text-black/65">
          The current watch firmware only emits motion (IMU) data. This tab activates
          automatically once the band starts publishing the signals listed below — no
          app update required.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {spec.needs.map((n) => (
            <li
              key={n}
              className="flex items-start gap-2 rounded-lg border border-black/[0.06] bg-black/[0.02] p-2.5 text-[11px] text-black/70"
            >
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <span className="font-mono">{n}</span>
            </li>
          ))}
        </ul>
      </Card>

      {spec.preview.map((section) => (
        <Card key={section.title} eyebrow="Preview" title={section.title} className="mb-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {section.rows.map((r) => (
              <Stat key={r.label} label={r.label} value="—" unit={r.unit} hint={r.hint} />
            ))}
          </div>
        </Card>
      ))}

      {spec.extra}

      <div className="mt-6 flex items-center justify-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-black/40">
        <Icon className="h-3.5 w-3.5" /> {spec.id}
      </div>
    </div>
  );
}
