import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Layout, type ViewId } from "@/components/vyro/Layout";
import { VyroBandProvider } from "@/components/vyro/VyroBandProvider";
import { HomeView } from "@/components/vyro/HomeView";
import { TrendsView } from "@/components/vyro/TrendsView";
import { SessionView } from "@/components/vyro/SessionView";
import { SportView } from "@/components/vyro/SportView";
import { RecoveryView } from "@/components/vyro/RecoveryView";
import { CoachView } from "@/components/vyro/CoachView";
import { SocialView } from "@/components/vyro/SocialView";
import { VideoView } from "@/components/vyro/VideoView";
import { DietView } from "@/components/vyro/DietView";
import { SleepView } from "@/components/vyro/SleepView";
import { ProfileView } from "@/components/vyro/ProfileView";
import { DebugView } from "@/components/vyro/DebugView";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: App,
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      const skipFlag =
        typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem("vyro_skip_onboarding") === "true";
      if (!skipFlag) throw redirect({ to: "/onboarding" });
    }
  },
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
    <VyroBandProvider>
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
        {activeView === "sleep" && <SleepView sleepTab={sleepTab} setSleepTab={setSleepTab} />}
        {activeView === "coach" && <CoachView />}
        {activeView === "social" && (
          <SocialView socialTab={socialTab} setSocialTab={setSocialTab} />
        )}
        {activeView === "video" && <VideoView />}
        {activeView === "diet" && <DietView />}
        {activeView === "profile" && <ProfileView onNavigate={(v) => setActiveView(v as ViewId)} />}
        {activeView === "debug" && <DebugView />}
      </Layout>
    </VyroBandProvider>
  );
}
