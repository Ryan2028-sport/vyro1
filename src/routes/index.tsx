import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/vyro/Layout";
import { HomeView } from "@/components/vyro/HomeView";
import { CoachView } from "@/components/vyro/CoachView";
import { DietView } from "@/components/vyro/DietView";
import { RecoveryView } from "@/components/vyro/RecoveryView";
import { SessionView } from "@/components/vyro/SessionView";
import { SleepView } from "@/components/vyro/SleepView";
import { SocialView } from "@/components/vyro/SocialView";
import { SportView } from "@/components/vyro/SportView";
import { TrendsView } from "@/components/vyro/TrendsView";
import { VideoView } from "@/components/vyro/VideoView";
import type { ViewId } from "@/lib/vyro-data";

export const Route = createFileRoute("/")({
  component: App,
  head: () => ({
    meta: [
      { title: "VYRO · Athlete Intelligence for Racket Sports" },
      {
        name: "description",
        content:
          "VYRO — tactical performance intelligence for squash and tennis athletes. Live recovery, T-control tracking, court heatmaps, AI video analysis.",
      },
    ],
  }),
});

function App() {
  const [view, setView] = useState<ViewId>("home");
  const [selectedSport, setSelectedSport] = useState("Squash");
  const [sportTab, setSportTab] = useState<"database" | "agility" | "swing">("database");
  const [recoveryTab, setRecoveryTab] = useState<"live" | "ingame" | "fatigue" | "overnight">("live");
  const [sleepTab, setSleepTab] = useState<"overall" | "timeline" | "wakeups" | "performance">("overall");
  const [socialTab, setSocialTab] = useState<"feed" | "profile" | "group" | "compete">("feed");

  const jump = (v: ViewId, _tab?: string) => setView(v);

  return (
    <Layout activeView={view} setView={setView}>
      {view === "home" && <HomeView jump={jump} />}
      {view === "trends" && <TrendsView />}
      {view === "session" && <SessionView />}
      {view === "sport" && (
        <SportView
          selectedSport={selectedSport}
          setSelectedSport={setSelectedSport}
          sportTab={sportTab}
          setSportTab={setSportTab}
        />
      )}
      {view === "recovery" && <RecoveryView recoveryTab={recoveryTab} setRecoveryTab={setRecoveryTab} />}
      {view === "sleep" && <SleepView sleepTab={sleepTab} setSleepTab={setSleepTab} />}
      {view === "coach" && <CoachView />}
      {view === "social" && <SocialView socialTab={socialTab} setSocialTab={setSocialTab} />}
      {view === "diet" && <DietView />}
      {view === "video" && <VideoView />}
    </Layout>
  );
}
