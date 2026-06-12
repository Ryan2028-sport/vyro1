import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { VideoView } from "@/components/vyro/VideoView";
import { DietView } from "@/components/vyro/DietView";
import { ProfileView } from "@/components/vyro/ProfileView";
import { VyroBandProvider } from "@/components/vyro/VyroBandProvider";

export const Route = createFileRoute("/_authenticated/app")({
  component: () => (
    <VyroBandProvider>
      <AppShell />
    </VyroBandProvider>
  ),
});

function AppShell() {
  const [view, setView] = useState<ViewId>("home");
  const [recoveryTab, setRecoveryTab] = useState<any>("live");
  const [sportTab, setSportTab] = useState<any>("agility");
  const [sleepTab, setSleepTab] = useState<any>("overall");
  const [socialTab, setSocialTab] = useState<any>("feed");
  const [selectedSport, setSelectedSport] = useState("Squash");

  const jump = (v: ViewId, tab?: string) => {
    setView(v);
    if (v === "recovery" && tab) setRecoveryTab(tab);
    if (v === "sport" && tab) setSportTab(tab);
    if (v === "sleep" && tab) setSleepTab(tab);
  };

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
      {view === "video" && <VideoView />}
      {view === "diet" && <DietView />}
      {view === "profile" && <ProfileView />}
    </Layout>
  );
}
