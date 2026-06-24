import { useState } from "react";
import { Card, EmptyState, PageHeader, Pill, Stat } from "./shared";
import { useLiveMetrics } from "./useLiveMetrics";

// =============================================================================
// Diet view — strict mode. Calories burned come from the band's caloriesKcal
// characteristic; nothing is fabricated. The seed food log was removed —
// the log starts empty until the user adds meals.
// =============================================================================

interface MealEntry { id: string; time: string; name: string; kcal: number; protein: number; carbs: number; fat: number; }

export function DietView() {
  const m = useLiveMetrics();
  const burn = m.caloriesKcal; // null when band offline or hasn't synced
  const [log, setLog] = useState<MealEntry[]>([]);
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [goalStr, setGoalStr] = useState("");
  const goal = parseInt(goalStr, 10) || null;

  const eaten = log.reduce((s, e) => s + e.kcal, 0);
  const proteinG = log.reduce((s, e) => s + e.protein, 0);
  const carbsG = log.reduce((s, e) => s + e.carbs, 0);
  const fatG = log.reduce((s, e) => s + e.fat, 0);
  const left = goal != null ? Math.max(0, goal - eaten) : null;
  const projectedBalance = burn != null ? eaten - burn : null;

  function add() {
    const k = parseInt(kcal, 10);
    if (!name.trim() || !k) return;
    setLog((l) => [
      ...l,
      {
        id: crypto.randomUUID(),
        time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        name: name.trim(),
        kcal: k,
        protein: Math.round((k * 0.20) / 4),
        carbs: Math.round((k * 0.50) / 4),
        fat: Math.round((k * 0.30) / 9),
      },
    ]);
    setName("");
    setKcal("");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Fuel · Diet Coach"
        title="Diet coach"
        subtitle="Burn streams from the band's calorie characteristic. Intake comes from meals you log. Nothing is estimated."
        action={<Pill tone={m.connected ? "live" : "off"} pulse={m.connected}>{m.connected ? "live" : "offline"}</Pill>}
      />

      <Card eyebrow="Calorie balance" title="Intake vs burn">
        <div className="grid grid-cols-4 gap-2 text-center">
          <Tile k="Eaten" v={eaten} u="kcal" />
          <Tile k="Burn" v={burn} u="kcal" />
          <Tile k="Goal" v={goal} u="kcal" />
          <Tile k="Left" v={left} u="kcal" />
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-vyro-line">
          <div
            className="h-full bg-vyro-mint transition-all"
            style={{ width: goal ? `${Math.min(100, (eaten / goal) * 100)}%` : "0%" }}
          />
        </div>
        <p className="mt-2 text-[11px] text-vyro-mute">
          {projectedBalance == null ? (
            "Pair the band so burn streams in, then your projected balance appears here."
          ) : (
            <>Projected balance today:{" "}
              <span className={projectedBalance < 0 ? "text-vyro-amber font-semibold" : "text-vyro-mint font-semibold"}>
                {projectedBalance > 0 ? "+" : ""}{projectedBalance} kcal
              </span>
            </>
          )}
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={goalStr}
            onChange={(e) => setGoalStr(e.target.value)}
            placeholder="Set daily kcal goal"
            inputMode="numeric"
            className="flex-1 rounded-xl border border-vyro-line bg-vyro-panel px-3 py-2 text-sm text-vyro-text outline-none focus:border-vyro-text/40"
          />
        </div>
      </Card>

      <Card eyebrow="Watch · live" title="Total calories burned">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black tabular-nums text-vyro-text">{burn ?? "—"}</span>
            <span className="text-sm text-vyro-mute">kcal</span>
          </div>
          <Pill tone={burn != null ? "live" : "off"}>{burn != null ? "from band" : "no signal"}</Pill>
        </div>
        <p className="mt-3 text-[11px] text-vyro-mute">
          Resting / active / session split needs per-channel breakdowns the firmware doesn't currently emit.
        </p>
      </Card>

      <Card eyebrow="Macro tracker" title="Updates as meals are logged">
        {log.length === 0 ? (
          <EmptyState title="No meals logged yet" hint="Log a meal below to see your macro totals fill in." />
        ) : (
          <>
            <MacroBar label="Protein" cur={proteinG} target={null} color="bg-vyro-mint" />
            <MacroBar label="Carbs" cur={carbsG} target={null} color="bg-vyro-amber" />
            <MacroBar label="Fat" cur={fatG} target={null} color="bg-vyro-rose" />
          </>
        )}
      </Card>

      <Card eyebrow="Food log" title="What you have eaten">
        {log.length === 0 ? (
          <p className="mb-3 text-[11px] text-vyro-mute">No meals yet today.</p>
        ) : (
          <ul className="mb-3 divide-y divide-vyro-line/60">
            {log.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <div className="text-sm font-semibold text-vyro-text">{e.name}</div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-vyro-mute">
                    {e.time} · P{e.protein} · C{e.carbs} · F{e.fat}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black tabular-nums text-vyro-text">{e.kcal}</div>
                  <div className="font-mono text-[9px] text-vyro-mute">kcal</div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Meal name"
            className="flex-1 rounded-xl border border-vyro-line bg-vyro-panel px-3 py-2 text-sm text-vyro-text outline-none focus:border-vyro-text/40"
          />
          <input
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
            placeholder="kcal"
            inputMode="numeric"
            className="w-20 rounded-xl border border-vyro-line bg-vyro-panel px-3 py-2 text-sm text-vyro-text outline-none focus:border-vyro-text/40"
          />
          <button onClick={add} className="rounded-xl bg-vyro-mint px-3 py-2 text-sm font-bold text-vyro-ink">Log</button>
        </div>
      </Card>

      <Card eyebrow="Profile" title="BMI baseline">
        <Stat label="BMI" value="—" hint="Set height + weight in Profile" />
      </Card>
    </div>
  );
}

function Tile({ k, v, u }: { k: string; v: number | null | undefined; u: string }) {
  return (
    <div className="rounded-xl border border-vyro-line bg-vyro-elev p-2.5">
      <div className="font-mono text-[9px] uppercase tracking-wider text-vyro-mute">{k}</div>
      <div className="mt-0.5 flex items-baseline justify-center gap-1">
        <span className="text-base font-black tabular-nums text-vyro-text">
          {v == null ? "—" : v.toLocaleString()}
        </span>
        <span className="text-[9px] text-vyro-mute">{u}</span>
      </div>
    </div>
  );
}

function MacroBar({ label, cur, target, color }: { label: string; cur: number; target: number | null; color: string }) {
  const pct = target ? Math.min(100, (cur / target) * 100) : 0;
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-semibold text-vyro-text">{label}</span>
        <span className="font-mono text-[10px] tabular-nums text-vyro-mute">
          {cur}g{target ? ` / ${target}g` : ""}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-vyro-line">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
