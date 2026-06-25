import { createFileRoute } from "@tanstack/react-router";
import { OnboardingFlow } from "@/components/vyro/onboarding/OnboardingFlow";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
  head: () => ({
    meta: [
      { title: "VYRO · Welcome" },
      { name: "description", content: "Get started with VYRO — your athlete intelligence platform." },
    ],
  }),
});

function OnboardingPage() {
  return <OnboardingFlow />;
}
