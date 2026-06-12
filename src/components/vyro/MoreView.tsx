import { ChevronRight } from "lucide-react";
import { PageHeader, Pill } from "./shared";
import { FEATURE_SPECS } from "./featureSpecs";
import type { ViewId } from "./Layout";

export function MoreView({ setView }: { setView: (v: ViewId) => void }) {
  return (
    <div>
      <PageHeader
        eyebrow="Modules"
        title="More"
        subtitle="Every Vyro feature in one place. Tap any tile to see what's coming next."
      />

      <div className="grid gap-2 sm:grid-cols-2">
        {FEATURE_SPECS.map((spec) => {
          const Icon = spec.icon;
          return (
            <button
              key={spec.id}
              onClick={() => setView(spec.id)}
              className="group flex items-center gap-3 rounded-2xl border border-black/[0.07] bg-white p-4 text-left transition-colors hover:border-black/20"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black text-white">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-bold text-black">{spec.label}</span>
                  <Pill tone="warn">soon</Pill>
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-black/55">
                  {spec.blurb}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-black/30 group-hover:text-black/60" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
