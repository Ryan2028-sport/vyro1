import { createFileRoute } from "@tanstack/react-router";
import { VyroBandProvider } from "@/components/vyro/VyroBandProvider";
import { App2ReferenceShell } from "@/components/vyro/App2ReferenceShell";

// /app2 = public mirror of /app. Uses the SAME VyroBandProvider so BLE
// pairing, firmware (OTA) updates, live metrics, and the always-on
// background session run identically here.
export const Route = createFileRoute("/app2")({
  ssr: false,
  component: () => (
    <VyroBandProvider>
      <App2ReferenceShell />
    </VyroBandProvider>
  ),
});
