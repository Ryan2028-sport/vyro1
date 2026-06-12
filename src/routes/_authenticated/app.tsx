import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
});

// Renders the original VYRO app (public/vyro-app.html) inside the
// authenticated route so the post-login UI matches the original design
// 1:1. Profile + band pairing lives at /app/profile (React).
function AppShell() {
  return (
    <div className="fixed inset-0 bg-black">
      <iframe
        src="/vyro-app.html"
        title="VYRO"
        className="h-full w-full border-0"
        allow="bluetooth; camera; microphone; accelerometer; gyroscope; magnetometer"
      />
      <Link
        to="/app/profile"
        className="fixed right-3 top-3 z-50 rounded-full border border-white/20 bg-black/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur hover:bg-black"
      >
        Profile & Band
      </Link>
    </div>
  );
}
