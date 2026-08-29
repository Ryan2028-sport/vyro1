import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy path: everything now lives at /app.
export const Route = createFileRoute("/app2")({
  beforeLoad: () => {
    throw redirect({ to: "/app", replace: true });
  },
});
