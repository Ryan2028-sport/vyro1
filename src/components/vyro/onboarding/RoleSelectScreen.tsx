import { Dumbbell, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function RoleSelectScreen({
  onSelect,
}: {
  onSelect: (role: "athlete" | "coach") => void;
}) {
  const handleSelect = async (role: "athlete" | "coach") => {
    try {
      await supabase.auth.updateUser({ data: { role } });
    } catch {
      // Skip mode — no user session
    }
    onSelect(role);
  };

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-white px-6">
      <h1 className="text-2xl font-bold text-gray-900">How will you use Vyro?</h1>
      <p className="mt-2 text-center text-[14px] text-gray-500">
        Choose your role to personalize your experience
      </p>

      <div className="mt-10 flex w-full max-w-sm flex-col gap-4">
        <button
          onClick={() => handleSelect("athlete")}
          className="group flex items-center gap-5 rounded-3xl border border-gray-200 bg-white p-5 text-left transition-all active:scale-[0.98] active:border-gray-300 active:bg-gray-50"
        >
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gray-100 transition-colors group-active:bg-gray-200">
            <Dumbbell className="h-6 w-6 text-gray-700" />
          </div>
          <div>
            <p className="text-[16px] font-semibold text-gray-900">
              I'm an Athlete
            </p>
            <p className="mt-0.5 text-[13px] text-gray-500">
              Track performance, sync your band, and get personalized insights
            </p>
          </div>
        </button>

        <button
          onClick={() => handleSelect("coach")}
          className="group flex items-center gap-5 rounded-3xl border border-gray-200 bg-white p-5 text-left transition-all active:scale-[0.98] active:border-gray-300 active:bg-gray-50"
        >
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gray-100 transition-colors group-active:bg-gray-200">
            <Users className="h-6 w-6 text-gray-700" />
          </div>
          <div>
            <p className="text-[16px] font-semibold text-gray-900">
              I'm a Coach
            </p>
            <p className="mt-0.5 text-[13px] text-gray-500">
              Monitor your athletes, analyze game footage, and guide training
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
