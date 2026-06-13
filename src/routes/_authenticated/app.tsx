import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { VyroBandProvider } from "@/components/vyro/VyroBandProvider";
import { Layout, type ViewId } from "@/components/vyro/Layout";
import { HomeView } from "@/components/vyro/HomeView";
import { SessionView } from "@/components/vyro/SessionView";
import { HistoryView } from "@/components/vyro/HistoryView";
import { ProfileView } from "@/components/vyro/ProfileView";
import { MoreView } from "@/components/vyro/MoreView";
import { AthleteView } from "@/components/vyro/AthleteView";
import { RecoveryView } from "@/components/vyro/RecoveryView";
import { SleepView } from "@/components/vyro/SleepView";
import { CourtDbView } from "@/components/vyro/CourtDbView";
import { SwingView } from "@/components/vyro/SwingView";
import { CoachView } from "@/components/vyro/CoachView";
import { DietView } from "@/components/vyro/DietView";
import { TendencyView } from "@/components/vyro/TendencyView";

export const Route = createFileRoute("/_authenticated/app")({
  component: () => (
    <VyroBandProvider>
      <AppShell />
    </VyroBandProvider>
  ),
});

function AppShell() {
  const [view, setView] = useState<ViewId>("home");

  function render() {
    switch (view) {
      case "home": return <HomeView setView={setView} />;
      case "session": return <SessionView />;
      case "history": return <HistoryView />;
      case "more": return <MoreView setView={setView} />;
      case "profile": return <ProfileView />;
      case "athlete": return <AthleteView />;
      case "recovery": return <RecoveryView />;
      case "sleep": return <SleepView />;
      case "court": return <CourtDbView />;
      case "swing": return <SwingView />;
      case "coach": return <CoachView />;
      case "diet": return <DietView />;
      case "tendency": return <TendencyView />;
      // Modules still on the roadmap fall back to the More grid.
      case "trends":
      case "video":
      case "social":
      case "sport":
      case "activity":
      default:
        return <MoreView setView={setView} />;
    }
  }

  return (
    <Layout activeView={view} setView={setView}>
      {render()}
    </Layout>
  );
}
