// Top-level VYRO modules. Each id maps to a dedicated view rendered by
// `src/routes/_authenticated/app.tsx`. Drives the More grid and the Home
// dashboard quick-nav.
import {
  Activity,
  Apple,
  Brain,
  HeartPulse,
  LayoutGrid,
  LineChart,
  Map,
  Moon,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ViewId } from "./Layout";

export interface NavSpec {
  id: ViewId;
  label: string;
  eyebrow: string;
  blurb: string;
  icon: LucideIcon;
}

export const FEATURE_SPECS: NavSpec[] = [
  {
    id: "sport",
    label: "Sport selector",
    eyebrow: "Pick a sport",
    icon: Trophy,
    blurb: "Open the Morphos suite for Baseball, Basketball, Football, Golf, Hockey, Soccer, Squash, or Tennis.",
  },
  {
    id: "athlete",
    label: "Athlete health",
    eyebrow: "24/7 · live",
    icon: HeartPulse,
    blurb: "Live HR, HRV, SpO₂, respiratory rate, skin temp, steps, calories, wear time, signal confidence.",
  },
  {
    id: "recovery",
    label: "Recovery & fatigue",
    eyebrow: "Readiness · live",
    icon: Activity,
    blurb: "LIVE recovery score, status band, total fatigue, time-to-ready, Return-to-Play validator.",
  },
  {
    id: "sleep",
    label: "Sleep",
    eyebrow: "Overnight · stages",
    icon: Moon,
    blurb: "Sleep score, stages, debt, consistency, wake events, recommended bedtime/wake.",
  },
  {
    id: "court",
    label: "Court & heat map",
    eyebrow: "Sport · movement",
    icon: Map,
    blurb: "Heat maps, route DB (T → corners / center → wide), zone occupancy, agility score.",
  },
  {
    id: "swing",
    label: "Swing & racket",
    eyebrow: "Per-swing · IMU",
    icon: Zap,
    blurb: "Racket head speed, swing force, contact quality, face angle, swing consistency profiles.",
  },
  {
    id: "coach",
    label: "Coach & tendencies",
    eyebrow: "Roster · plan",
    icon: Brain,
    blurb: "Player load, match-day readiness, tendency database, threat index, AI weekly plan.",
  },
  {
    id: "diet",
    label: "Diet coach",
    eyebrow: "Fuel · calories",
    icon: Apple,
    blurb: "Resting + active calories burned, macro targets, daily fuel guidance.",
  },
  {
    id: "trends",
    label: "Trends",
    eyebrow: "Weeks · months",
    icon: LineChart,
    blurb: "Long-term load, recovery, sleep debt, swing volume and peak motion trends.",
  },
  {
    id: "tendency",
    label: "Match database",
    eyebrow: "Tendencies · opponents",
    icon: LayoutGrid,
    blurb: "Shot tendencies, rally length, point outcomes, opponent threat profiles.",
  },
  {
    id: "social",
    label: "Social",
    eyebrow: "Friends · feed",
    icon: Users,
    blurb: "Follow training partners, share sessions, compare weekly volume.",
  },
];
