import { createFileRoute, Link } from "@tanstack/react-router";
import { VyroBandProvider } from "@/components/vyro/VyroBandProvider";
import { ProfileView } from "@/components/vyro/ProfileView";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppPage,
});

function AppPage() {
  const [showProfile, setShowProfile] = useState(false);

  return (
    <VyroBandProvider>
      <div className="relative h-svh w-svw bg-white">
        <iframe
          src="/vyro-app.html"
          title="VYRO"
          className="absolute inset-0 h-full w-full border-0"
        />
        <button
          onClick={() => setShowProfile(true)}
          className="absolute top-3 right-3 z-50 rounded-full bg-black/85 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur hover:bg-black"
        >
          Profile & Band
        </button>
        {showProfile && (
          <div className="absolute inset-0 z-40 overflow-auto bg-gradient-to-b from-slate-950 to-slate-900 p-4 text-white">
            <button
              onClick={() => setShowProfile(false)}
              className="mb-4 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
            >
              ← Back to app
            </button>
            <ProfileView />
          </div>
        )}
      </div>
    </VyroBandProvider>
  );
}
