import { useEffect, useRef, useState } from "react";
import { Card, PageHeader, Spark } from "./shared";

export function SessionView() {
  const [live, setLive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    if (live) {
      ref.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => {
      if (ref.current) window.clearInterval(ref.current);
    };
  }, [live]);

  const start = () => {
    setSeconds(0);
    setLive(true);
  };
  const stop = () => setLive(false);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const stats: [string, string][] = [
    ["Elapsed", `${mm}:${ss}`],
    ["Heart Rate", live ? "156 bpm" : "72 bpm"],
    ["Movement", "6.8 g"],
    ["T Recoveries", live ? "18" : "0"],
    ["T Control", live ? "74%" : "0%"],
  ];

  return (
    <>
      <PageHeader
        eyebrow="Session · T-Control Tracking"
        title="Court session"
        action={
          live ? (
            <button
              onClick={stop}
              className="rounded-xl border border-vyro-red/40 bg-vyro-red/15 px-4 py-2 text-sm font-medium text-vyro-red"
            >
              End session
            </button>
          ) : (
            <button onClick={start} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white">
              Start session
            </button>
          )
        }
      />
      <div className="grid gap-4 lg:grid-cols-5">
        {stats.map((x) => (
          <Card key={x[0]}>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">{x[0]}</div>
            <div className="mt-2 text-4xl font-semibold tabular-nums">{x[1]}</div>
          </Card>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">Heart rate · 60s</div>
          <Spark points={[25, 35, 48, 60, 72, 67, 80, 74, 84, 78]} color="var(--vyro-red)" />
        </Card>
        <Card>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">Acceleration · burst detection</div>
          <Spark points={[8, 12, 40, 75, 20, 18, 85, 44, 16, 10]} color="var(--vyro-amber)" />
        </Card>
      </div>
    </>
  );
}
