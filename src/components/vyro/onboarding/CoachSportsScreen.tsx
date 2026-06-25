import { useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const sports = [
  "Squash",
  "Tennis",
  "Badminton",
  "Table Tennis",
  "Padel",
  "Racquetball",
  "Cricket",
  "Basketball",
  "Soccer",
  "Running",
  "Swimming",
  "Cycling",
  "Boxing",
  "Volleyball",
  "Hockey",
  "Rugby",
];

export function CoachSportsScreen({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (sport: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sport)) {
        next.delete(sport);
      } else {
        next.add(sport);
      }
      return next;
    });
  };

  const handleDone = async () => {
    try {
      await supabase.auth.updateUser({
        data: {
          coaching_sports: Array.from(selected),
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
      <p className="text-[12px] font-medium tracking-wide text-gray-400 uppercase">
        Almost there
      </p>

      <div className="mx-auto mt-8 flex w-full max-w-sm flex-1 flex-col">
        <h1 className="text-2xl font-bold text-gray-900">
          Which sports do you coach?
        </h1>
        <p className="mt-2 text-[14px] text-gray-500">
          Select all that apply. This helps us tailor your dashboard.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3">
          {sports.map((sport) => {
            const active = selected.has(sport);
            return (
              <button
                key={sport}
                onClick={() => toggle(sport)}
                className={`relative flex h-[52px] items-center justify-center rounded-2xl border text-[14px] font-medium transition-all active:scale-[0.97] ${
                  active
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 bg-white text-gray-700"
                }`}
              >
                {sport}
                {active && (
                  <Check className="absolute right-3 h-4 w-4" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto w-full max-w-sm">
        <button
          onClick={handleDone}
          disabled={selected.size === 0}
          className="h-[52px] w-full rounded-2xl bg-gray-900 text-[15px] font-semibold text-white transition-colors disabled:opacity-30 active:bg-gray-800"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}
