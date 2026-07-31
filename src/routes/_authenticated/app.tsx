import { createFileRoute } from "@tanstack/react-router";
import { VyroBandProvider } from "@/components/vyro/VyroBandProvider";
import { VyroScoresProvider } from "@/components/vyro/VyroScoresProvider";
import { App2ReferenceShell } from "@/components/vyro/App2ReferenceShell";

export const Route = createFileRoute("/_authenticated/app")({
  component: () => (
    <VyroBandProvider>
      <VyroScoresProvider>
        <App2ReferenceShell />
      </VyroScoresProvider>
    </VyroBandProvider>
  ),
});
