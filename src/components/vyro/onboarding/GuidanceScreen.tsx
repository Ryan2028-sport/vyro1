import { useState } from "react";
import { ArrowLeft, Target, HeartPulse, Brain } from "lucide-react";

const options = [
  {
    id: "optimal-training",
    icon: Target,
    title: "Optimal Training",
    description:
      "Help me increase athletic performance without overtraining.",
  },
  {
    id: "general-fitness",
    icon: HeartPulse,
    title: "General Fitness",
    description: "Help me improve my fitness and overall health.",
  },
  {
    id: "focus-wellness",
    icon: Brain,
    title: "Focus on Wellness",
    description:
      "Help me understand my body and improve overall health.",
  },
] as const;

export function GuidanceScreen({
  onNext,
}: {
  onNext: (selected: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen w-full flex-col bg-white px-6 pb-10 pt-4">
      {/* Step indicator */}
      <div className="flex items-center gap-3">
        <p className="text-[12px] font-medium tracking-wide text-gray-400 uppercase">
          Step 1 of 2
        </p>
      </div>

      <div className="mx-auto mt-8 flex w-full max-w-sm flex-1 flex-col">
        <h1 className="text-2xl font-bold text-gray-900">
          How can Vyro best guide you?
        </h1>
        <p className="mt-2 text-[14px] text-gray-500">
          Choose the option that best applies.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          {options.map(({ id, icon: Icon, title, description }) => (
            <button
              key={id}
              onClick={() => setSelected(id)}
              className={`flex items-start gap-4 rounded-3xl border p-5 text-left transition-all active:scale-[0.98] ${
                selected === id
                  ? "border-gray-900 bg-gray-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors ${
                  selected === id
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-gray-900">
                  {title}
                </p>
                <p className="mt-0.5 text-[13px] text-gray-500">
                  {description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Next button */}
      <div className="mx-auto w-full max-w-sm">
        <button
          onClick={() => selected && onNext(selected)}
          disabled={!selected}
          className="h-[52px] w-full rounded-2xl bg-gray-900 text-[15px] font-semibold text-white transition-colors disabled:opacity-30 active:bg-gray-800"
        >
          Next
        </button>
      </div>
    </div>
  );
}
