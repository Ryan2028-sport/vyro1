import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { VyroBandProvider } from "@/components/vyro/VyroBandProvider";
import { Layout, type ViewId } from "@/components/vyro/Layout";
import { HomeView } from "@/components/vyro/HomeView";
import { SessionView } from "@/components/vyro/SessionView";
import { HistoryView } from "@/components/vyro/HistoryView";
import { ProfileView } from "@/components/vyro/ProfileView";
import { MoreView } from "@/components/vyro/MoreView";
import { ComingSoonView } from "@/components/vyro/ComingSoonView";
import { FEATURE_SPECS } from "@/components/vyro/featureSpecs";

export const Route = createFileRoute("/_authenticated/app")({
  component: () => (
    <VyroBandProvider>
      <AppShell />
    </VyroBandProvider>
  ),
});

function AppShell() {
  const [view, setView] = useState<ViewId>("home");
  const featureSpec = FEATURE_SPECS.find((s) => s.id === view);

  return (
    <Layout activeView={view} setView={setView}>
      {view === "home" && <HomeView setView={setView} />}
      {view === "session" && <SessionView />}
      {view === "history" && <HistoryView />}
      {view === "more" && <MoreView setView={setView} />}
      {view === "profile" && <ProfileView />}
      {featureSpec && <ComingSoonView spec={featureSpec} setView={setView} />}
    </Layout>
  );
}
