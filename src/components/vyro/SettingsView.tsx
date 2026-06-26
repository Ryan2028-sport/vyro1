import { Watch } from "lucide-react";

export function SettingsView() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Devices */}
      <section>
        <h2 className="mb-3 px-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-gray-400">
          Devices
        </h2>
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <a
            href="/bluetooth"
            className="flex items-center gap-4 px-4 py-4 transition-colors active:bg-gray-50"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gray-100">
              <Watch className="h-5 w-5 text-gray-700" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-medium text-gray-900">Watch Test</p>
              <p className="text-[13px] text-gray-500">Scan and connect via Bluetooth</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_theme(colors.emerald.400)]" />
              Live
            </span>
          </a>
        </div>
      </section>
    </div>
  );
}
