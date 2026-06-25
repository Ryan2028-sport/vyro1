import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Layout } from "@/components/vyro/Layout";
import { HomeView } from "@/components/vyro/HomeView";
import { TrendsView } from "@/components/vyro/TrendsView";
import { SessionView } from "@/components/vyro/SessionView";
import { SportView } from "@/components/vyro/SportView";
import { RecoveryView } from "@/components/vyro/RecoveryView";
import { CoachView } from "@/components/vyro/CoachView";
import { SocialView } from "@/components/vyro/SocialView";
import { VideoView } from "@/components/vyro/VideoView";
import { DietView } from "@/components/vyro/DietView";
import type { ViewId } from "@/lib/vyro-data";

export const Route = createFileRoute("/")({
  component: App,
  // TODO(temp): Onboarding redirect is disabled during development.
  // Re-enable the beforeLoad guard below when onboarding should be enforced.
  // beforeLoad: () => { ... redirect to /onboarding if not completed ... }
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
  const [activeView, setActiveView] = useState<ViewId>("home");
  const [selectedSport, setSelectedSport] = useState("Squash");
  const [sportTab, setSportTab] = useState<"database" | "agility" | "swing">("database");
  const [recoveryTab, setRecoveryTab] = useState<"live" | "ingame" | "fatigue" | "overnight">("live");
  const [sleepTab, setSleepTab] = useState<"overall" | "timeline" | "wakeups" | "performance">("overall");
  const [recoverySection, setRecoverySection] = useState<"recovery" | "sleep">("recovery");
  const [socialTab, setSocialTab] = useState<"feed" | "profile" | "group" | "compete">("feed");

  const jump = (v: ViewId, tab?: string) => {
    if (v === "sleep") {
      setActiveView("recovery");
      setRecoverySection("sleep");
      if (tab) setSleepTab(tab as typeof sleepTab);
      return;
    }
    setActiveView(v);
    if (v === "sport" && tab) setSportTab(tab as typeof sportTab);
    if (v === "recovery" && tab) setRecoveryTab(tab as typeof recoveryTab);
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
      {activeView === "recovery" && (
        <RecoveryView
          recoveryTab={recoveryTab}
          setRecoveryTab={setRecoveryTab}
          sleepTab={sleepTab}
          setSleepTab={setSleepTab}
          section={recoverySection}
          setSection={setRecoverySection}
        />
      )}
      {activeView === "coach" && <CoachView />}
      {activeView === "social" && (
        <SocialView socialTab={socialTab} setSocialTab={setSocialTab} />
      )}
      {activeView === "video" && <VideoView />}
      {activeView === "diet" && <DietView />}
    </Layout>
  );
}
