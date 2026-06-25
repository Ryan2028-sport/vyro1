import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const goals = [
  "Improve sleep",
  "Recover faster",
  "Build muscle",
  "Lose weight",
  "Increase fitness",
  "Track & measure workouts",
  "Optimize workout intensity",
  "Prevent overtraining",
  "Peak for competition",
  "Reduce injury risk",
];

export function GoalsScreen({
  guidance,
  onComplete,
}: {
  guidance: string | null;
  onComplete: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (goal: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(goal)) {
        next.delete(goal);
      } else {
        next.add(goal);
      }
      return next;
    });
  };

  const handleDone = async () => {
    try {
      await supabase.auth.updateUser({
        data: {
          guidance,
          goals: Array.from(selected),
          onboarding_complete: true,
        },
      });
    } catch {
      // Skip mode
    }
    onComplete();
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-white px-6 pb-10 pt-4">
      {/* Step indicator */}
      <p className="text-[12px] font-medium tracking-wide text-gray-400 uppercase">
        Step 2 of 2
      </p>

      <div className="mx-auto mt-8 flex w-full max-w-sm flex-1 flex-col">
        <h1 className="text-2xl font-bold text-gray-900">
          What are your goals and interests?
        </h1>
        <p className="mt-2 text-[14px] text-gray-500">
          Select all that apply. You can change these later.
        </p>

        <div className="mt-8 flex flex-wrap gap-2.5">
          {goals.map((goal) => {
            const active = selected.has(goal);
            return (
              <button
                key={goal}
                onClick={() => toggle(goal)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-[14px] font-medium transition-all active:scale-95 ${
                  active
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 bg-white text-gray-700"
                }`}
              >
                {goal}
                {active ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Plus className="h-3.5 w-3.5 text-gray-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="mx-auto w-full max-w-sm">
        <button
          onClick={handleDone}
          className="h-[52px] w-full rounded-2xl bg-gray-900 text-[15px] font-semibold text-white transition-colors active:bg-gray-800"
        >
          {selected.size > 0 ? "Get Started" : "Skip"}
        </button>
      </div>
    </div>
  );
}
