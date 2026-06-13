import { ChevronRight } from "lucide-react";
import { PageHeader } from "./shared";
import { FEATURE_SPECS } from "./featureSpecs";
import type { ViewId } from "./Layout";

export function MoreView({ setView }: { setView: (v: ViewId) => void }) {
  return (
    <div>
      <PageHeader
        eyebrow="Modules"
        title="More"
        subtitle="Every VYRO domain. Tap any tile to open the full screen."
      />

      <div className="grid gap-2 sm:grid-cols-2">
        {FEATURE_SPECS.map((spec) => {
          const Icon = spec.icon;
          return (
            <button
              key={spec.id}
              onClick={() => setView(spec.id)}
              className="group flex items-center gap-3 rounded-2xl border border-vyro-text/[0.07] bg-vyro-panel p-4 text-left transition-colors hover:border-vyro-text/20"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-vyro-mint text-white">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-vyro-text">{spec.label}</span>
                <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-vyro-text/55">
                  {spec.blurb}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-vyro-text/30 group-hover:text-vyro-text/60" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
