import { Bar, Card, PageHeader } from "./shared";

export function DietView() {
  return (
    <>
      <PageHeader
        eyebrow="Diet Coach · live calorie logic"
        title="Nutrition target updates with your burn."
        subtitle="BMI-informed calorie and macro tracking tied to total burn, rest burn, working burn, and goal."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="text-white/45">Total calories burned</div>
          <div className="mt-2 text-5xl font-black">1,842</div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div>Rest burn<br /><b>620</b></div>
            <div>Work burn<br /><b>1,222</b></div>
          </div>
        </Card>
        <Card>
          <div className="text-white/45">BMI baseline</div>
          <div className="mt-2 text-5xl font-black">23.5</div>
          <div className="mt-4 flex gap-2">
            <button className="rounded-lg bg-white/10 px-3 py-2 text-xs">Gain</button>
            <button className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-black">Maintain</button>
            <button className="rounded-lg bg-white/10 px-3 py-2 text-xs">Lose</button>
          </div>
        </Card>
        <Card>
          <div className="text-white/45">Daily intake goal</div>
          <div className="mt-2 text-5xl font-black">2,600</div>
          <div className="mt-4">Consumed 680 / 2,600<Bar value={26} /></div>
        </Card>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="font-black">Macro tracker</h3>
          <div className="mt-4 space-y-4">
            <div>Protein 56/152g<Bar value={37} color="amber" /></div>
            <div>Carbs 88/312g<Bar value={28} color="amber" /></div>
            <div>Fat 14/72g<Bar value={19} color="amber" /></div>
          </div>
        </Card>
        <Card>
          <h3 className="font-black">Food log</h3>
          <div className="mt-4 space-y-2">
            <div>Protein oats · 420 kcal</div>
            <div>Greek yogurt + fruit · 260 kcal</div>
            <button className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-bold text-black">+ Add meal</button>
          </div>
        </Card>
      </div>
    </>
  );
}
