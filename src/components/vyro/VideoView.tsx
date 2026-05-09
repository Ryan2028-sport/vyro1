import { useState } from "react";
import { Camera, Play } from "lucide-react";
import { sportProfiles } from "@/lib/vyro-data";
import { Card, PageHeader } from "./shared";
import { SportSwing } from "./SportView";

export function VideoView() {
  const [state, setState] = useState<"idle" | "ready">("idle");
  return (
    <>
      <PageHeader
        eyebrow="AI Video Analyzer"
        title="Frame-level technique intelligence"
        subtitle="Movement · Technique · Shot Selection synced with IMU and HR signatures."
      />
      {state === "idle" ? (
        <Card>
          <div className="py-12 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-white/15 bg-white/10">
              <Camera className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-xl font-black">Upload or record a clip</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/55">
              60-second clip or full match. VYRO analyzes movement, swing technique, and shot selection in context.
            </p>
            <button
              onClick={() => setState("ready")}
              className="mt-5 rounded-xl bg-white px-5 py-3 text-sm font-bold text-black"
            >
              Upload clip
            </button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="grid aspect-video place-items-center rounded-2xl border border-white/10 bg-black">
              <div className="grid h-16 w-16 place-items-center rounded-full border border-white/20 bg-white/10">
                <Play className="h-8 w-8" />
              </div>
            </div>
          </Card>
          <Card>
            <h3 className="font-black">Swing path · 3D visualization</h3>
            <div className="mt-4">
              <SportSwing profile={sportProfiles.Squash} />
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
