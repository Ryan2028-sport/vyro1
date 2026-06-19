import { createFileRoute } from "@tanstack/react-router";

// /app2 mirrors the original bundled HTML 1:1 by serving it as-is.
// The file lives at public/vyro-reference.html so it's byte-identical
// to the upload (no React re-implementation drift).
export const Route = createFileRoute("/app2")({
  ssr: false,
  component: App2Frame,
});

function App2Frame() {
  return (
    <iframe
      src="/vyro-reference.html"
      title="VYRO reference app"
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", border: 0 }}
    />
  );
}
