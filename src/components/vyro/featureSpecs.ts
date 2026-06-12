import {
  Activity,
  Apple,
  Brain,
  Dumbbell,
  HeartPulse,
  LineChart,
  Moon,
  Users,
  Video,
} from "lucide-react";
import type { ComingSoonSpec } from "./ComingSoonView";

export const FEATURE_SPECS: ComingSoonSpec[] = [
  {
    id: "sleep",
    label: "Sleep",
    eyebrow: "Recovery · overnight",
    icon: Moon,
    blurb:
      "Sleep stages, time in bed, wake events and a nightly sleep score derived from heart rate and motion overnight.",
    needs: [
      "Heart-rate stream (PPG) at 1 Hz",
      "Wrist temperature characteristic",
      "Sleep-mode flag from firmware",
    ],
    preview: [
      {
        title: "Last night",
        rows: [
          { label: "Sleep score", unit: "/100" },
          { label: "Time in bed", unit: "h" },
          { label: "Efficiency", unit: "%" },
          { label: "REM", unit: "h" },
          { label: "Deep", unit: "h" },
          { label: "Light", unit: "h" },
        ],
      },
      {
        title: "Trends",
        rows: [
          { label: "7-day avg", unit: "h" },
          { label: "Consistency", unit: "%" },
          { label: "Resting HR", unit: "bpm" },
        ],
      },
    ],
  },
  {
    id: "recovery",
    label: "Recovery",
    eyebrow: "Readiness · this morning",
    icon: HeartPulse,
    blurb:
      "Daily recovery score from HRV, resting heart rate and sleep quality — tells you how hard to train today.",
    needs: ["HRV (RMSSD) calculation", "Resting heart rate", "Sleep score from firmware"],
    preview: [
      {
        title: "Today",
        rows: [
          { label: "Recovery", unit: "%" },
          { label: "HRV", unit: "ms" },
          { label: "Resting HR", unit: "bpm" },
          { label: "Strain yesterday" },
          { label: "Sleep debt", unit: "h" },
        ],
      },
    ],
  },
  {
    id: "trends",
    label: "Trends",
    eyebrow: "Long-term · weekly",
    icon: LineChart,
    blurb:
      "Charts across weeks and months: training load, swing volume, peak motion and recovery balance.",
    needs: ["At least 14 days of session data", "Daily recovery score backfill"],
    preview: [
      {
        title: "30-day rollup",
        rows: [
          { label: "Sessions" },
          { label: "Total swings" },
          { label: "Avg session", unit: "min" },
          { label: "Peak G trend" },
          { label: "Strain trend" },
          { label: "Recovery trend" },
        ],
      },
    ],
  },
  {
    id: "diet",
    label: "Diet",
    eyebrow: "Fuel · daily",
    icon: Apple,
    blurb:
      "Manual food logging plus calorie/macro targets based on your strain. Photo-to-meal scanning later.",
    needs: ["Food log UI (manual entry — not blocked by firmware)", "Daily strain from sessions"],
    preview: [
      {
        title: "Today",
        rows: [
          { label: "Calories", unit: "kcal" },
          { label: "Protein", unit: "g" },
          { label: "Carbs", unit: "g" },
          { label: "Fat", unit: "g" },
          { label: "Water", unit: "L" },
          { label: "Target", unit: "kcal" },
        ],
      },
    ],
  },
  {
    id: "coach",
    label: "Coach",
    eyebrow: "AI · weekly plan",
    icon: Brain,
    blurb:
      "AI coach that reads your sessions and recovery, then suggests drills, rest days, and weekly focus.",
    needs: ["At least 5 logged sessions", "Recovery score signal"],
    preview: [
      {
        title: "This week's plan",
        rows: [
          { label: "Focus" },
          { label: "Target sessions" },
          { label: "Suggested rest days" },
          { label: "Drill 1" },
          { label: "Drill 2" },
          { label: "Drill 3" },
        ],
      },
    ],
  },
  {
    id: "video",
    label: "Video",
    eyebrow: "Capture · technique",
    icon: Video,
    blurb:
      "Record a swing on phone, sync to the IMU timeline, and review frame-by-frame with motion overlay.",
    needs: ["Phone camera capture permission", "IMU timestamp sync to video frames"],
    preview: [
      {
        title: "Latest clips",
        rows: [
          { label: "Clips this week" },
          { label: "Annotated" },
          { label: "Last upload" },
        ],
      },
    ],
  },
  {
    id: "social",
    label: "Social",
    eyebrow: "Friends · feed",
    icon: Users,
    blurb:
      "Follow training partners, share sessions and PRs, and compare weekly volume on a leaderboard.",
    needs: ["Friend graph table", "Public session visibility setting"],
    preview: [
      {
        title: "Your circle",
        rows: [
          { label: "Following" },
          { label: "Followers" },
          { label: "Weekly rank" },
          { label: "Friends active" },
        ],
      },
    ],
  },
  {
    id: "sport",
    label: "Sport profiles",
    eyebrow: "Calibration · per sport",
    icon: Dumbbell,
    blurb:
      "Sport-specific tuning for swing detection (squash, tennis, padel, golf, boxing). Picks the right event thresholds.",
    needs: ["Per-sport threshold profile in firmware", "Handedness flag stored in profile"],
    preview: [
      {
        title: "Active profile",
        rows: [
          { label: "Sport" },
          { label: "Handedness" },
          { label: "Swing threshold" },
          { label: "Burst threshold" },
        ],
      },
    ],
  },
  {
    id: "activity",
    label: "Activity",
    eyebrow: "All-day · motion",
    icon: Activity,
    blurb:
      "All-day motion summary: active minutes, intensity, and a daily move goal built from IMU energy.",
    needs: ["Background BLE keep-alive (needs native bridge)", "Daily IMU energy aggregation"],
    preview: [
      {
        title: "Today",
        rows: [
          { label: "Active min" },
          { label: "Intensity" },
          { label: "Peak window" },
          { label: "Move goal", unit: "%" },
        ],
      },
    ],
  },
];
