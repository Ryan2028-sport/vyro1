import { createFileRoute } from "@tanstack/react-router";
import VyroApp from "@/components/VyroApp";

export const Route = createFileRoute("/")({
  component: VyroApp,
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
