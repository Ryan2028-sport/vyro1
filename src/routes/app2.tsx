import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/app2")({
  component: App2Redirect,
});

function App2Redirect() {
  useEffect(() => {
    window.location.replace("/app2.html");
  }, []);
  return null;
}
