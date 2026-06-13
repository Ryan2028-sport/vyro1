import { Card, PageHeader, Pill, Stat } from "./shared";

// Sleep zone from the VYRO spec. All metrics here come from the firmware's
// sleep-mode actigraphy + nightly summary, which is not yet emitted.
export function SleepView() {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Overnight · stages"
        title="Sleep"
        subtitle="Sleep score, stages, debt, consistency and wake events from overnight band data."
        action={<Pill tone="warn">awaiting sleep packet</Pill>}
      />

      <Card eyebrow="Last night · top-line" title="Sleep quality">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Sleep score" value="—" unit="/100" />
          <Stat label="Time in bed" value="—" unit="h" />
          <Stat label="Asleep" value="—" unit="h" />
          <Stat label="Efficiency" value="—" unit="%" />
        </div>
      </Card>

      <Card eyebrow="Stages · 30-s epochs" title="Sleep stages">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Deep" value="—" unit="h" />
          <Stat label="REM" value="—" unit="h" />
          <Stat label="Light" value="—" unit="h" />
          <Stat label="Awake" value="—" unit="h" />
        </div>
      </Card>

      <Card eyebrow="Schedule · consistency" title="Bedtime & wake">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Bedtime" value="—" />
          <Stat label="Wake time" value="—" />
          <Stat label="Sleep latency" value="—" unit="min" />
          <Stat label="Consistency" value="—" unit="%" />
          <Stat label="Recommended bedtime" value="—" />
          <Stat label="Recommended wake" value="—" />
        </div>
      </Card>

      <Card eyebrow="Debt · targets" title="Sleep debt">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Sleep needed" value="—" unit="h" />
          <Stat label="Sleep debt" value="—" unit="h" />
          <Stat label="7-night trend" value="—" />
          <Stat label="Sleep performance" value="—" unit="%" />
          <Stat label="Restorative" value="—" unit="h" />
        </div>
      </Card>

      <Card eyebrow="Wake events" title="Overnight wakes">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Wake count" value="—" />
          <Stat label="Longest wake" value="—" unit="min" />
          <Stat label="Last wake" value="—" />
          <Stat label="Driver" value="—" hint="movement · HR · resp" />
        </div>
      </Card>
    </div>
  );
}
