import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";

export const Route = createFileRoute("/")({
  component: App,
  head: () => ({
    meta: [
      { title: "VYRO · Athlete Intelligence for Racket Sports" },
      {
        name: "description",
        content:
          "VYRO — tactical performance intelligence for squash and tennis athletes. Live recovery, T-control tracking, court heatmaps, AI video analysis.",
      },
    ],
  }),
});

function App() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const syncIframeHeight = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;

    if (!iframe || !doc) return;

    const height = Math.max(
      window.innerHeight,
      doc.documentElement.scrollHeight,
      doc.body.scrollHeight,
    );

    iframe.style.height = `${height}px`;
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let observer: ResizeObserver | undefined;

    const setupObserver = () => {
      syncIframeHeight();
      const doc = iframe.contentDocument;
      if (!doc || typeof ResizeObserver === "undefined") return;

      observer?.disconnect();
      observer = new ResizeObserver(syncIframeHeight);
      observer.observe(doc.documentElement);
      observer.observe(doc.body);
    };

    setupObserver();
    iframe.addEventListener("load", setupObserver);
    window.addEventListener("resize", syncIframeHeight);
    const interval = window.setInterval(syncIframeHeight, 500);

    return () => {
      iframe.removeEventListener("load", setupObserver);
      window.removeEventListener("resize", syncIframeHeight);
      window.clearInterval(interval);
      observer?.disconnect();
    };
  }, [syncIframeHeight]);

  return (
    <iframe
      ref={iframeRef}
      src="/vyro-app.html"
      title="VYRO Athlete OS"
      scrolling="no"
      className="block min-h-screen w-full border-0"
    />
  );
}
