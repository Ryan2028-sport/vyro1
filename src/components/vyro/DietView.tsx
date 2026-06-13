import { Card, PageHeader, Pill, Stat } from "./shared";

// Diet coach view from the VYRO spec. Calorie split (resting / active /
// session) requires the firmware's calorie packet; macro targets come from
// profile + load and can be implemented client-side later.
export function DietView() {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Fuel · calories"
        title="Diet coach"
        subtitle="Daily fuel — calories burned, macro targets, and load-aware adjustments."
        action={<Pill tone="warn">awaiting calorie packet</Pill>}
      />

      <Card eyebrow="Burn · today" title="Calories burned">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Total" value="—" unit="kcal" />
          <Stat label="Resting" value="—" unit="kcal" hint="BMR" />
          <Stat label="Active" value="—" unit="kcal" hint="HR + IMU" />
          <Stat label="Session" value="—" unit="kcal" />
        </div>
      </Card>

      <Card eyebrow="Targets" title="Daily targets">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Calories" value="—" unit="kcal" />
          <Stat label="Protein" value="—" unit="g" />
          <Stat label="Carbs" value="—" unit="g" />
          <Stat label="Fat" value="—" unit="g" />
        </div>
      </Card>

      <Card eyebrow="Today" title="Logged">
        <div className="rounded-xl border border-dashed border-black/15 bg-black/[0.02] p-4 text-center text-[11px] text-black/45">
          Food log + photo-to-meal — Phase 2
        </div>
      </Card>
    </div>
  );
}
