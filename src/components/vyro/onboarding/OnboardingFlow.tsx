import { useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SplashScreen } from "./SplashScreen";
import { WelcomeScreen } from "./WelcomeScreen";
import { AuthScreen } from "./AuthScreen";
import { RoleSelectScreen } from "./RoleSelectScreen";
import { BandSyncScreen } from "./BandSyncScreen";
import { GuidanceScreen } from "./GuidanceScreen";
import { GoalsScreen } from "./GoalsScreen";
import { CoachSportsScreen } from "./CoachSportsScreen";
import { supabase } from "@/integrations/supabase/client";

type AuthMode = "signup" | "login";
type Role = "athlete" | "coach";

type Step =
  | "splash"
  | "welcome"
  | "auth"
  | "role"
  | "band-sync"
  | "guidance"
  | "goals"
  | "coach-sports";

export function OnboardingFlow() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("splash");
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [role, setRole] = useState<Role>("athlete");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [guidance, setGuidance] = useState<string | null>(null);

  const goTo = useCallback(
    (next: Step, dir: "forward" | "back" = "forward") => {
      setDirection(dir);
      setStep(next);
    },
    [],
  );

  const completeOnboarding = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      await supabase.auth.updateUser({
        data: { onboarding_complete: true },
      });
      localStorage.setItem("vyro_onboarding_complete", "true");
    }
    // TODO(temp): Guest bypass — sessionStorage flag lets unauthenticated
    // users access the app for the current browser session only. On
    // reload/new tab they're sent back to onboarding. Remove once auth
    // is enforced and guest access is no longer needed.
    sessionStorage.setItem("vyro_skip_onboarding", "true");
    navigate({ to: "/" });
  }, [navigate]);

  // TODO(temp): "Skip for now" bypasses auth for dev/testing. Advances
  // through the rest of onboarding without creating an account. Remove
  // or hide behind a feature flag before production.
  const handleSkip = useCallback(() => {
    sessionStorage.setItem("vyro_skip_onboarding", "true");
    goTo("role");
  }, [goTo]);

  return (
    <div className="fixed inset-0 bg-white overflow-y-auto">
      <div
        className={`min-h-full w-full transition-opacity duration-300 ${
          direction === "forward" ? "animate-in fade-in" : ""
        }`}
        key={step}
      >
        {step === "splash" && (
          <SplashScreen onComplete={() => goTo("welcome")} />
        )}

        {step === "welcome" && (
          <WelcomeScreen
            onJoin={() => {
              setAuthMode("signup");
              goTo("auth");
            }}
            onLogin={() => {
              setAuthMode("login");
              goTo("auth");
            }}
            onSkip={handleSkip}
          />
        )}

        {step === "auth" && (
          <AuthScreen
            mode={authMode}
            onToggleMode={() =>
              setAuthMode((m) => (m === "signup" ? "login" : "signup"))
            }
            onSuccess={() => goTo("role")}
            onBack={() => goTo("welcome", "back")}
          />
        )}

        {step === "role" && (
          <RoleSelectScreen
            onSelect={(r) => {
              setRole(r);
              if (r === "athlete") {
                goTo("band-sync");
              } else {
                goTo("coach-sports");
              }
            }}
          />
        )}

        {step === "band-sync" && (
          <BandSyncScreen onContinue={() => goTo("guidance")} />
        )}

        {step === "guidance" && (
          <GuidanceScreen
            onNext={(selected) => {
              setGuidance(selected);
              goTo("goals");
            }}
          />
        )}

        {step === "goals" && (
          <GoalsScreen
            guidance={guidance}
            onComplete={completeOnboarding}
          />
        )}

        {step === "coach-sports" && (
          <CoachSportsScreen onComplete={completeOnboarding} />
        )}
      </div>
    </div>
  );
}
