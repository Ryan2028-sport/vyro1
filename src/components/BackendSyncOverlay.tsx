import { useState, useEffect } from "react";
import { Loader2, ServerCog, CheckCircle2 } from "lucide-react";

const TOTAL_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours
const STORAGE_KEY = "app_backend_sync_start_time";

const BackendSyncOverlay = () => {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Persist start time so a page refresh doesn't reset the 12-hour timer
    let startTime = localStorage.getItem(STORAGE_KEY);
    if (!startTime) {
      startTime = Date.now().toString();
      localStorage.setItem(STORAGE_KEY, startTime);
    }

    const updateProgress = () => {
      const elapsed = Date.now() - parseInt(startTime as string, 10);
      const currentProgress = Math.min((elapsed / TOTAL_DURATION_MS) * 100, 100);
      setProgress(currentProgress);
      if (currentProgress >= 100) setIsComplete(true);
    };

    updateProgress();
    const intervalId = setInterval(updateProgress, 10000);
    return () => clearInterval(intervalId);
  }, []);

  const remainingMs = Math.max(TOTAL_DURATION_MS - (progress / 100) * TOTAL_DURATION_MS, 0);
  const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
  const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <style>{`@keyframes vyro-sync-shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-2xl flex flex-col items-center transition-all">
        {!isComplete ? (
          <>
            <div className="relative mb-6">
              <ServerCog className="h-16 w-16 animate-pulse text-primary" />
              <Loader2 className="absolute -bottom-2 -right-2 h-6 w-6 animate-spin rounded-full bg-card text-primary/70" />
            </div>

            <h2 className="mb-3 text-2xl font-bold text-foreground">
              Backend is being updated
            </h2>

            <p className="mb-8 text-sm text-muted-foreground">
              The backend is being updated and synced with the frontend. Please leave this page open
              or check back later.
            </p>


            <div className="relative w-full">
              <div className="mb-3 h-4 w-full overflow-hidden rounded-full bg-muted shadow-inner">
                <div
                  className="relative h-4 overflow-hidden rounded-full bg-primary transition-all duration-1000 ease-linear"
                  style={{ width: `${progress}%` }}
                >
                  <div
                    className="absolute inset-0 w-full bg-foreground/20"
                    style={{ animation: "vyro-sync-shimmer 2s infinite" }}
                  />
                </div>
              </div>

              <div className="flex w-full justify-between text-sm font-semibold text-muted-foreground">
                <span>{progress.toFixed(2)}%</span>
                <span>
                  ETA: {remainingHours}h {remainingMinutes}m
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center duration-500 animate-in fade-in zoom-in">
            <CheckCircle2 className="mb-6 h-20 w-20 text-emerald-500" />

            <h2 className="mb-3 text-2xl font-bold text-foreground">100% Update Complete</h2>

            <p className="mb-8 text-sm text-muted-foreground">
              Frontend has successfully synced with the new backend architecture.
            </p>

            <button
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                window.location.reload();
              }}
              className="w-full rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
            >
              Enter Application
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackendSyncOverlay;
