/**
 * VYRO global design tokens — Cupertino bento, light mode.
 * Hex values mirror the CSS custom properties in src/styles.css
 * (`--vyro-*`) so React logic and Tailwind utilities stay in sync.
 *
 * Prefer Tailwind utilities (bg-vyro-surface, text-vyro-recovery, …)
 * in JSX. Use this object only when you need the raw value
 * (inline SVG strokes, canvas, conic-gradient strings, etc.).
 */
export const TOKENS = {
  COLOR: {
    CANVAS: "#FFFFFF",
    SURFACE: "#F5F5F7",
    ACCENT_POS: "#34C759",
    ACCENT_SPATIAL: "#007AFF",
    WARNING_FATIGUE: "#FF3B30",
  },
  RADIUS: "rounded-3xl",
  SHADOW: "shadow-sm",
} as const;

export type VyroMetricType = "RECOVERY" | "FATIGUE" | "SPATIAL" | "WARNING";

/**
 * Return-to-Play clearance gate.
 *
 * Implements the "Double-Check" engine: an athlete is only cleared
 * when BOTH the video-derived joint symmetry and wearable-derived
 * power output are within 5% of their personal historical baseline.
 *
 * @param videoSymmetry  Ratio (0–1) of current vs. baseline joint symmetry from video AI.
 * @param wearablePower  Ratio (0–1) of current vs. baseline power output from wearable telemetry.
 * @returns true when the athlete is cleared for play.
 */
export function checkClearance(videoSymmetry: number, wearablePower: number): boolean {
  const BASELINE_THRESHOLD = 0.95;
  return videoSymmetry >= BASELINE_THRESHOLD && wearablePower >= BASELINE_THRESHOLD;
}
