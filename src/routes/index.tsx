import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { ViewId } from "@/lib/vyro-data";
import { Layout } from "@/components/vyro/Layout";
import { HomeView } from "@/components/vyro/HomeView";
import { TrendsView } from "@/components/vyro/TrendsView";
import { SessionView } from "@/components/vyro/SessionView";
import { SportView } from "@/components/vyro/SportView";
import { RecoveryView } from "@/components/vyro/RecoveryView";
import { SleepView } from "@/components/vyro/SleepView";
import { CoachView } from "@/components/vyro/CoachView";
import { SocialView } from "@/components/vyro/SocialView";
import { DietView } from "@/components/vyro/DietView";
import { VideoView } from "@/components/vyro/VideoView";

export const Route = createFileRoute("/")({
  component: App,
  head: () => ({
    meta: [
      { title: "VYRO Athlete OS" },
      { name: "description", content: "Tactical performance intelligence for athletes." },
    ],
  }),
});

function App() {
  const [activeView, setActiveView] = useState<ViewId>("home");
  const [sportTab, setSportTab] = useState<"database" | "agility" | "swing">("database");
  const [selectedSport, setSelectedSport] = useState("Squash");
  const [recoveryTab, setRecoveryTab] = useState<"live" | "ingame" | "fatigue" | "overnight">("live");
  const [sleepTab, setSleepTab] = useState<"overall" | "timeline" | "wakeups" | "performance">("overall");
  const [socialTab, setSocialTab] = useState<"feed" | "profile" | "group" | "compete">("feed");

  const jump = (v: ViewId, tab?: string) => {
    if (v === "recovery") setRecoveryTab((tab as typeof recoveryTab) || "live");
    if (v === "sleep") setSleepTab((tab as typeof sleepTab) || "overall");
    if (v === "sport") setSportTab((tab as typeof sportTab) || "database");
    setActiveView(v);
  };

  return (
    <Layout activeView={activeView} setView={setActiveView}>
      {activeView === "home" && <HomeView jump={jump} />}
      {activeView === "trends" && <TrendsView />}
      {activeView === "session" && <SessionView />}
      {activeView === "sport" && (
        <SportView
          selectedSport={selectedSport}
          setSelectedSport={setSelectedSport}
          sportTab={sportTab}
          setSportTab={setSportTab}
        />
      )}
      {activeView === "recovery" && <RecoveryView recoveryTab={recoveryTab} setRecoveryTab={setRecoveryTab} />}
      {activeView === "sleep" && <SleepView sleepTab={sleepTab} setSleepTab={setSleepTab} />}
      {activeView === "coach" && <CoachView />}
      {activeView === "social" && <SocialView socialTab={socialTab} setSocialTab={setSocialTab} />}
      {activeView === "video" && <VideoView />}
      {activeView === "diet" && <DietView />}
    </Layout>
  );
}
