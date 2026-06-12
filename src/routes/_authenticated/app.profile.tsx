import { createFileRoute, Link } from "@tanstack/react-router";
import { ProfileView } from "@/components/vyro/ProfileView";
import { VyroBandProvider } from "@/components/vyro/VyroBandProvider";

export const Route = createFileRoute("/_authenticated/app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <VyroBandProvider>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),transparent_28%),linear-gradient(180deg,#080808,#000)] text-white">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <Link
            to="/app"
            className="mb-4 inline-block font-mono text-[10px] uppercase tracking-[0.3em] text-white/45 hover:text-white"
          >
            ← Back to app
          </Link>
          <ProfileView />
        </div>
      </div>
    </VyroBandProvider>
  );
}
