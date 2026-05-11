import { createFileRoute } from "@tanstack/react-router";

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

import { HomeView } from "@/components/vyro/HomeView";

function App() {
  return <HomeView />;
}
