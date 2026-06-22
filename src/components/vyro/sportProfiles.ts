// Sport-specific Morphos modules. Mirrors the reference HTML `Ap` object —
// each sport carries its own database cards, tendency reads, agility
// components, movement map, and slow-motion metrics.

export interface SportMetric { label: string; value: number; unit: string; insight: string; }
export interface SportCard { title: string; metric: string; detail: string; value: number; }
export interface TendencyRow { zone: string; read: string; pressure: "Baseline" | "Adjustment" | "Critical" | "Fatigue" | "Scout" | "Technique risk"; }
export interface AgilityComponent { label: string; detail: string; value: number; }
export interface PerformanceGroup { label: string; status: string; value: number; metrics: { label: string; value: number; warn?: boolean }[]; }
export interface MovementItem { name: string; detail: string; value: string; }
export interface RouteMapItem {
  name: string;
  firstStep: string; // e.g. "2.1ft"
  steps: number;
  rtT: string;       // e.g. "1.32s"
  score: number;
  start: { x: number; y: number }; // 0-1 within mini court
  end: { x: number; y: number };
}
export interface SportVariant { label: string; detail: string; }
export interface ContactCell { label: string; value: string; }

export interface SportProfile {
  id: string;
  label: string;
  emoji: string;
  databaseLabel: string;
  databaseTitle: string;
  databaseSubtitle: string;
  databaseCards: SportCard[];
  tendencyRows: TendencyRow[];
  agilityTitle: string;
  agilitySummary: string;
  agilityComponents: AgilityComponent[];
  performanceGroups?: PerformanceGroup[];
  movementTitle: string;
  movementItems: MovementItem[];
  routeMap?: RouteMapItem[];
  routeMapFooter?: string;
  motionTitle: string;
  motionSubtitle: string;
  framePill: string;
  contactGrid: ContactCell[];
  metrics: SportMetric[];
  variants?: SportVariant[];
  insight: string;
}

export const SPORT_PROFILES: SportProfile[] = [
  {
    id: "baseball",
    label: "Baseball", emoji: "⚾",
    databaseLabel: "Field DB",
    databaseTitle: "Mound Intelligence suite",
    databaseSubtitle: "Pitching arm slot, bat path, position-player throws, cognitive reaction, and arm-health risk.",
    databaseCards: [
      { title: "3D Arm-Slot Rendering", metric: "Release window", detail: "Maps exact arm path during pitching and tags release-window drift as a fatigue event.", value: 86 },
      { title: "3D Bat Path", metric: "Barrel shape", detail: "Shows whether the bat starts too low, casts away from the body, or matches the target swing.", value: 84 },
      { title: "Tommy John Hazard", metric: "Lead-foot plant + arm speed", detail: "Flags high arm speed paired with soft or late leg plant as elbow-overload risk.", value: 77 },
      { title: "Cognitive Fatigue", metric: "Reaction time", detail: "Alerts when HR is normal but reaction time slows by 200ms or more.", value: 81 },
    ],
    tendencyRows: [
      { zone: "Innings 1-3 · 0 outs", read: "Pitcher attacks heater up/in 48% · slider away 22%", pressure: "Baseline" },
      { zone: "Innings 4-6 · 1 out", read: "Changeup usage rises to 31% after first-time-through looks", pressure: "Adjustment" },
      { zone: "Innings 7-9 · 2 outs", read: "Slider-away tendency jumps to 44% as wrist-speed decays", pressure: "Fatigue" },
      { zone: "RISP · any inning", read: "Fastball rate drops; pitcher hunts swing-and-miss off-speed", pressure: "Critical" },
    ],
    agilityTitle: "Pitcher · arm-slot stability",
    agilitySummary: "Release point, lead-leg block, varus torque, and tunneling consistency under fatigue.",
    agilityComponents: [
      { label: "Arm slot", detail: "High 3/4 baseline; drift triggers fatigue tag.", value: 86 },
      { label: "Slot drift watch", detail: "Release point stays inside the healthy window until late-game fatigue appears.", value: 82 },
      { label: "Bat/ball timing", detail: "TTI 142ms — hands-to-contact timing supports late decision-making against velocity.", value: 84 },
      { label: "Elbow varus load", detail: "Torque signature rises when lead-leg block is late.", value: 77 },
      { label: "Mechanical Decay Index", detail: "Rolling workload score replaces pitch count with stress count.", value: 79 },
    ],
    movementTitle: "Mound + box snapshot",
    movementItems: [
      { name: "Plant phase", detail: "Lead-foot strike timing", value: "84" },
      { name: "Arm path", detail: "3D arm slot rendering", value: "86" },
      { name: "Release window", detail: "Drift watch · fatigue tag", value: "82" },
      { name: "Bat path", detail: "Casting risk · lead-arm radius", value: "80" },
      { name: "Time-to-impact", detail: "Hands-to-contact 142ms", value: "84" },
      { name: "UCL stress", detail: "Rolling stress count", value: "77" },
    ],
    motionTitle: "Slow-motion pitch view · release sequencing",
    motionSubtitle: "Arm slot, release point, lead-leg block, varus torque, and tunneling consistency.",
    framePill: "Pitch 27 / Inning 5",
    contactGrid: [
      { label: "Arm slot", value: "High 3/4" },
      { label: "Release window", value: "3% stable" },
      { label: "Time-to-impact", value: "142ms" },
      { label: "Coach cue", value: "Hold velo" },
    ],
    metrics: [
      { label: "Arm slot", value: 86, unit: "/100", insight: "Release remains inside the healthy window until late-game fatigue appears." },
      { label: "Elbow varus load", value: 77, unit: "/100", insight: "Torque signature rises when lead-leg block is late." },
      { label: "Bat path efficiency", value: 82, unit: "/100", insight: "Casting risk stays low when the lead-arm radius remains compact." },
      { label: "Time-to-impact", value: 142, unit: "ms", insight: "Hands-to-contact timing supports late decision-making against velocity." },
      { label: "Mechanical Decay Index", value: 79, unit: "/100", insight: "Rolling workload score replaces pitch count with stress count." },
      { label: "UCL stress accumulation", value: 12, unit: "%", insight: "Stress count remains below the same-week alert threshold." },
    ],
    variants: [
      { label: "Pitcher", detail: "Arm slot, release point, lead-leg block, varus torque, and tunneling consistency." },
      { label: "Position throw", detail: "J-path efficiency, transfer time, and accuracy under live-ball pressure." },
    ],
    insight: "VYRO double-checks wearable arm-speed against video arm-slot so workload, mechanics, and arm-health risk live in one model.",
  },
  {
    id: "basketball",
    label: "Basketball", emoji: "🏀",
    databaseLabel: "Court DB",
    databaseTitle: "Hardwood Load suite",
    databaseSubtitle: "Defensive-slide mechanics, jump impulse, landing load, and substitution-ready recovery.",
    databaseCards: [
      { title: "Jump Impulse", metric: "Wearable power output", detail: "Wearable power output compared with shot arc from video.", value: 81 },
      { title: "Landing Load", metric: "G-force score", detail: "G-force landing score paired with flat-footed video classification.", value: 76 },
      { title: "Defensive Slide Geometry", metric: "Shin angle", detail: "Shin-to-ground angle and micro-shuffle quality under fatigue.", value: 78 },
      { title: "Substitution Readiness", metric: "Live Recovery", detail: "Live Recovery and high-intensity possession load for coach decisions.", value: 74 },
    ],
    tendencyRows: [
      { zone: "Q1 · after live-ball turnover", read: "Transition rate spikes; rim attempts rise to 47%", pressure: "Baseline" },
      { zone: "Q3 · 1st possession after timeout", read: "Set play tendency: wing flare into catch-and-shoot", pressure: "Adjustment" },
      { zone: "Q4 · under 4:00", read: "Primary ball-handler rejects screen 42% when defender is fatigued", pressure: "Critical" },
      { zone: "Bonus situation", read: "Drive rate rises 19% · help-side rotation must load early", pressure: "Scout" },
    ],
    agilityTitle: "Basketball load and mechanics",
    agilitySummary: "Defensive-slide mechanics, jump impulse, landing load, and substitution-ready recovery.",
    agilityComponents: [
      { label: "Defensive Slide Geometry", detail: "Shin-to-ground angle and micro-shuffle quality under fatigue.", value: 78 },
      { label: "Jump Impulse", detail: "Wearable power output compared with shot arc from video.", value: 81 },
      { label: "Landing Load", detail: "G-force landing score paired with flat-footed video classification.", value: 76 },
      { label: "Substitution Readiness", detail: "Live Recovery and high-intensity possession load.", value: 74 },
    ],
    movementTitle: "Court movement snapshot",
    movementItems: [
      { name: "Defensive slide", detail: "Micro-shuffles · shin angle · stiffness alert", value: "78" },
      { name: "Closeout", detail: "First two steps · decel into contest", value: "80" },
      { name: "Jump shot", detail: "Jump impulse · shot arc correlation", value: "81" },
      { name: "Landing", detail: "G-force · flat-footed risk", value: "76" },
    ],
    motionTitle: "Basketball motion snapshot · jump and landing",
    motionSubtitle: "Early model for jump impulse, shot arc, defensive slide mechanics, and landing load.",
    framePill: "Possession 8",
    contactGrid: [
      { label: "Primary read", value: "Jump impulse" },
      { label: "Video check", value: "Shot arc" },
      { label: "Landing load", value: "High-G watch" },
      { label: "Coach cue", value: "Sub if red" },
    ],
    metrics: [
      { label: "Jump impulse", value: 81, unit: "/100", insight: "Shot arc begins to flatten when jump impulse drops more than 10%." },
      { label: "Slide stiffness", value: 78, unit: "/100", insight: "Defensive stance is becoming stiff enough to raise ankle-roll risk." },
      { label: "Landing quality", value: 76, unit: "/100", insight: "Heavy landings need video confirmation for flat-footed mechanics." },
    ],
    variants: [
      { label: "Guard", detail: "Slide stiffness, closeout decel, jump impulse, and reaction timing." },
      { label: "Big", detail: "Landing load, rebound impact, contact tolerance, and substitution readiness." },
    ],
    insight: "Basketball keeps the same double-check logic: wearable power and load are checked against visible mechanics before VYRO calls the athlete ready.",
  },
  {
    id: "football",
    label: "Football", emoji: "🏈",
    databaseLabel: "Field DB",
    databaseTitle: "Pocket & Route suite",
    databaseSubtitle: "QB throw path, route sharpness, explosive burst decay, contact load, and live roster readiness.",
    databaseCards: [
      { title: "3D Throw Path", metric: "Arm trajectory + release point", detail: "Generates a 3D rendering of the QB arm path and ball release point.", value: 88 },
      { title: "QB Kinetic Sequencing", metric: "Time-to-release", detail: "Measures plant phase to ball leaving hand in milliseconds.", value: 84 },
      { title: "Explosive Burst Decay", metric: "15% drop predictor", detail: "Predicts when peak acceleration will fall based on internal strain.", value: 81 },
      { title: "Contact Load Scoring", metric: "G-force + head position", detail: "Pairs wearable impact with video posture to identify dangerous lowered-head contact.", value: 78 },
    ],
    tendencyRows: [
      { zone: "1st down · Q1-Q2", read: "Play-action tendency 36% after two successful runs", pressure: "Baseline" },
      { zone: "2nd/long · midfield", read: "Route concept shifts to dig/crosser when QB pressure rate rises", pressure: "Adjustment" },
      { zone: "3rd down · red zone", read: "Slot option route becomes primary read 41%", pressure: "Critical" },
      { zone: "Q4 · hurry-up", read: "Release window drops 3.4% · checkdown rate rises", pressure: "Fatigue" },
    ],
    agilityTitle: "Football agility and movement efficiency",
    agilitySummary: "Explosive movement plus technical sequencing under contact, pressure, and late-game fatigue.",
    agilityComponents: [
      { label: "Explosive Burst Decay", detail: "Predictive curve flags when peak acceleration drops by more than 15%.", value: 81 },
      { label: "Acceleration", detail: "Real acceleration speeds and movement velocity for two-week agility averages.", value: 87 },
      { label: "Break-Point Deceleration", detail: "G-force during the plant foot on 90° or 180° cuts.", value: 83 },
      { label: "Route Sharpness Decay", detail: "Milliseconds added to cut time between early and late targets.", value: 79 },
      { label: "Pocket Quietness", detail: "Upper-body carriage stability while the feet move.", value: 84 },
    ],
    movementTitle: "Position-specific movement map",
    movementItems: [
      { name: "QB plant → release", detail: "Plant detection to ball exit timing", value: "84" },
      { name: "J-path efficiency", detail: "Compact arm circle; ball does not drop below chest", value: "82" },
      { name: "WR break point", detail: "Decel load on 90° or 180° cut", value: "83" },
      { name: "Late hands", detail: "Hand-flash timing avoids tipping DBs", value: "81" },
      { name: "OL strike", detail: "Punch velocity and two-hand synchronicity", value: "79" },
      { name: "Contact posture", detail: "Impact load plus head-position classification", value: "78" },
    ],
    motionTitle: "QB throw shape · release sequencing",
    motionSubtitle: "J-path efficiency, shoulder layback, hip-shoulder separation, release window, and throw classification.",
    framePill: "Throw 14 / Drive",
    contactGrid: [
      { label: "Throw class", value: "Bullet" },
      { label: "Release window", value: "3% stable" },
      { label: "Time-to-release", value: "418ms" },
      { label: "Sequencing", value: "Plant → release" },
    ],
    metrics: [
      { label: "J-path efficiency", value: 82, unit: "/100", insight: "Compact arm circle avoids wind-up and keeps the ball above chest level." },
      { label: "Time-to-release", value: 418, unit: "ms", insight: "Plant-to-release timing is fast enough for pressure windows." },
      { label: "Shoulder layback", value: 92, unit: "°", insight: "External rotation supports velocity without exceeding the stress range." },
      { label: "Hip-shoulder separation", value: 41, unit: "°", insight: "X-factor torque separates elite arm strength from average throwers." },
      { label: "Release consistency", value: 88, unit: "/100", insight: "Release point remains stable; late-game drop is the fatigue signal." },
      { label: "Throwing Fatigue Index", value: 12, unit: "%", insight: "Release window has not crossed the 3% deviation alert in this drive." },
    ],
    variants: [
      { label: "QB throw", detail: "J-path, layback, hip-shoulder separation, release point, and time-to-release." },
      { label: "WR route", detail: "Burst speed, break-point decel, route overlay, hand-flash timing, and sharpness decay." },
      { label: "Contact", detail: "G-force load, head posture, substitution logic, and team live recovery." },
    ],
    insight: "The same motion-shape engine becomes a QB throw engine by replacing racket face with release window, contact point with ball exit, and swing path with arm trajectory.",
  },
  {
    id: "golf",
    label: "Golf", emoji: "⛳",
    databaseLabel: "Course DB",
    databaseTitle: "Mental & Physical Sync suite",
    databaseSubtitle: "3D swing path, pressure-readiness, impact timing, and movement decay across 18 holes.",
    databaseCards: [
      { title: "3D Path Analysis", metric: "Club path + contact points", detail: "Renders exact club shape to evaluate swing plane, attack angle, and impact position.", value: 88 },
      { title: "Heavy Strike Index", metric: "Vibration signature", detail: "Separates flushed center-face strikes from thin or fat shots using high-frequency vibration.", value: 91 },
      { title: "Flow-State Capture", metric: "HRV-triggered recording", detail: "Saves swings only when Live Recovery shows a calm, performance-ready state.", value: 84 },
      { title: "Movement Decay", metric: "Hole 15-18 fatigue profile", detail: "Tracks whether kinematic sequencing breaks down as the round gets longer.", value: 79 },
    ],
    tendencyRows: [
      { zone: "Holes 1-6 · tee", read: "Driver tempo stable at 3:1 · face closure neutral", pressure: "Baseline" },
      { zone: "Approach over water", read: "Tempo speeds up 8% · miss pattern short-right", pressure: "Critical" },
      { zone: "Holes 15-18", read: "Lead-arm decel early · low-point control drifts", pressure: "Fatigue" },
      { zone: "Short game under par-save", read: "Grip tension spike predicts thin contact tendency", pressure: "Technique risk" },
    ],
    agilityTitle: "Golf movement efficiency",
    agilitySummary: "VYRO treats golf movement as repeatable sequencing: load, transition, impact, and balanced finish under fatigue.",
    agilityComponents: [
      { label: "Tempo Metronome", detail: "Backswing-to-downswing rhythm against the 3:1 pro benchmark.", value: 87 },
      { label: "Lag Retention", detail: "Angle between lead arm and club shaft during the downswing.", value: 82 },
      { label: "Weight Transfer", detail: "Virtual pressure plate mapping hip/shoulder tilt against wearable motion.", value: 85 },
      { label: "Sway & Tilt Control", detail: "AI Video-Sync detects lateral head or hip drift and alerts the wrist.", value: 78 },
      { label: "Finish Completion", detail: "Lead-arm deceleration curve confirms the athlete did not quit on the shot.", value: 86 },
    ],
    movementTitle: "Swing sequencing map",
    movementItems: [
      { name: "Address → takeaway", detail: "Grip pressure stable · no early wrist roll", value: "91" },
      { name: "Top of swing", detail: "Virtual top-of-swing stop · haptic cue ready", value: "84" },
      { name: "Transition", detail: "Lag retained · casting risk low", value: "82" },
      { name: "Impact", detail: "Center-face strike · heavy strike index high", value: "91" },
      { name: "Post-impact", detail: "Lead arm decel smooth · balanced finish", value: "86" },
      { name: "Late round", detail: "Movement decay watch · rest cue if pattern degrades", value: "78" },
    ],
    motionTitle: "Slow-motion golf swing · club path focus",
    motionSubtitle: "Club face, attack angle, strike quality, tempo, lag, and follow-through completion.",
    framePill: "Swing 18 / Round",
    contactGrid: [
      { label: "Contact surface", value: "Center club face" },
      { label: "Face angle", value: "2° closed" },
      { label: "Impact timing", value: "On-time" },
      { label: "Shot output", value: "Flush + stable" },
    ],
    metrics: [
      { label: "Club head speed", value: 103, unit: "mph", insight: "Speed peaks when the transition stays smooth and lag is retained." },
      { label: "Lag retention score", value: 82, unit: "/100", insight: "Early release raises casting risk and lowers strike quality." },
      { label: "Heavy Strike Index", value: 91, unit: "/100", insight: "Vibration profile matches a center-face strike rather than thin or fat contact." },
      { label: "Tempo ratio", value: 3.1, unit: ":1", insight: "Backswing-to-downswing ratio is inside the pro rhythm window." },
      { label: "Grip tension spike", value: 12, unit: "%", insight: "Transition tension remains below haptic alert threshold." },
      { label: "Follow-through completion", value: 86, unit: "/100", insight: "Lead-arm deceleration curve shows a complete, balanced finish." },
    ],
    variants: [
      { label: "Driver", detail: "Club path, attack angle, face closure, and power-to-fatigue ratio." },
      { label: "Iron", detail: "Low-point control, heavy strike index, wrist roll, and posture retention." },
      { label: "Pressure shot", detail: "Tempo drift vs. baseline when the shot is marked critical." },
    ],
    insight: "The same swing-shape engine becomes a golf club-path engine: VYRO maps the moving implement, contact surface, face angle, impact timing, and fatigue-driven sequencing decay.",
  },
  {
    id: "hockey",
    label: "Hockey", emoji: "🏒",
    databaseLabel: "Ice DB",
    databaseTitle: "Symmetry & Stride suite",
    databaseSubtitle: "Bare-bones hockey module for left/right thrust symmetry, oxygen-debt shift clock, and transition efficiency.",
    databaseCards: [
      { title: "Lateral Thrust Symmetry", metric: "Left vs. right push-off", detail: "Compares explosive left-leg and right-leg push-off to catch hidden groin or hip strain.", value: 82 },
      { title: "Oxygen-Debt Bench Clock", metric: "90% stride power restored", detail: "Uses Live Recovery to tell coaches when the athlete has recovered enough explosive stride power for the next shift.", value: 74 },
      { title: "Transition Efficiency", metric: "Skate-blade angle + HR spike", detail: "Pairs video blade angle through turns with wearable strain to separate poor recovery from poor technique.", value: 79 },
      { title: "Cutting Readiness", metric: "Symmetry RTP", detail: "Return-to-play check for left/right force symmetry after strain.", value: 81 },
    ],
    tendencyRows: [
      { zone: "Defensive-zone faceoff", read: "Expected shot: point wrister through traffic · blocker-side rebound", pressure: "Baseline" },
      { zone: "2nd period · long change", read: "Rush chance tendency rises when back-check transition efficiency drops", pressure: "Adjustment" },
      { zone: "Power play · left circle", read: "One-timer probability 46% · goalie load shifts glove-side", pressure: "Critical" },
      { zone: "Late shift · net front", read: "Low-slot rebound chance rises as stride power falls below 90%", pressure: "Fatigue" },
    ],
    agilityTitle: "Hockey symmetry and stride",
    agilitySummary: "Stride symmetry, transition mechanics, live recovery between shifts, and fatigue-aware substitution timing.",
    agilityComponents: [
      { label: "Lateral Thrust Symmetry", detail: "Left-leg vs. right-leg explosive push-off from wearable G-force.", value: 82 },
      { label: "Stride Power Recovery", detail: "Bench countdown until 90% explosive stride power returns.", value: 74 },
      { label: "Transition Efficiency", detail: "Skate-blade angle plus heart-rate spike on turns.", value: 79 },
      { label: "Cutting Readiness", detail: "Return-to-play check for left/right force symmetry after strain.", value: 81 },
    ],
    movementTitle: "Shift movement snapshot",
    movementItems: [
      { name: "Left push-off", detail: "G-force · stride asymmetry watch", value: "82" },
      { name: "Right push-off", detail: "Explosive stride baseline", value: "88" },
      { name: "Transition turn", detail: "Blade angle · HR spike", value: "79" },
      { name: "Bench recovery", detail: "90% stride power countdown", value: "74" },
    ],
    motionTitle: "Hockey motion snapshot · stride and transition",
    motionSubtitle: "Early model for explosive stride power, left/right symmetry, transition turns, and shift recovery.",
    framePill: "Shift 3",
    contactGrid: [
      { label: "Primary read", value: "Stride power" },
      { label: "Symmetry", value: "Left -7%" },
      { label: "Recovery", value: "86% restored" },
      { label: "Coach cue", value: "Hold shift" },
    ],
    metrics: [
      { label: "Stride symmetry", value: 82, unit: "/100", insight: "Left-leg push-off is lagging right-leg power enough to monitor groin/hip strain." },
      { label: "Explosive power restored", value: 86, unit: "%", insight: "Bench clock has not reached the 90% next-shift threshold yet." },
      { label: "Transition efficiency", value: 79, unit: "/100", insight: "Blade angle drift suggests technique decay as recovery drops." },
    ],
    variants: [
      { label: "Forward", detail: "Explosive shift repeats, transition turns, back-check efficiency." },
      { label: "Defense", detail: "Lateral symmetry, gap control, contact tolerance, and shift-pair recovery." },
    ],
    insight: "Hockey leans on symmetry and oxygen-debt science so coaches can substitute on biology, not the clock.",
  },
  {
    id: "soccer",
    label: "Soccer", emoji: "⚽",
    databaseLabel: "Pitch DB",
    databaseTitle: "Strike Tracking suite",
    databaseSubtitle: "Strike mechanics, sprint repeatability, change-of-direction load, and minutes-played readiness.",
    databaseCards: [
      { title: "Strike Mechanics", metric: "Plant + strike foot", detail: "Pairs plant-foot timing with strike-foot motion to score finishing technique.", value: 84 },
      { title: "Sprint Repeatability", metric: "30m repeat decay", detail: "Tracks how peak sprint output decays across the half and match.", value: 79 },
      { title: "Change-of-Direction Load", metric: "90° cut force", detail: "Lateral cut load aggregated across the match to surface hidden adductor risk.", value: 82 },
      { title: "Minutes-Played Readiness", metric: "Sub gate", detail: "Combines Live Recovery and HR-debt to time substitutions.", value: 76 },
    ],
    tendencyRows: [
      { zone: "First 15 min", read: "High press triggers · midfield pressure rate 38%", pressure: "Baseline" },
      { zone: "After conceding", read: "Wide overlap tendency rises to 44%", pressure: "Adjustment" },
      { zone: "Final third · 75-90", read: "Through-ball attempt rate doubles when fullback fatigue rises", pressure: "Fatigue" },
      { zone: "Set piece in box", read: "Near-post run probability 41% · zonal mark must load early", pressure: "Critical" },
    ],
    agilityTitle: "Soccer agility and load",
    agilitySummary: "Sprint repeatability, change-of-direction load, and substitution-ready recovery.",
    agilityComponents: [
      { label: "Sprint repeatability", detail: "Peak output decay across the half.", value: 79 },
      { label: "Cut load", detail: "G-force on 90° change of direction.", value: 82 },
      { label: "Strike mechanics", detail: "Plant + strike-foot sequencing.", value: 84 },
      { label: "Sub readiness", detail: "HR debt + Live Recovery score.", value: 76 },
    ],
    movementTitle: "Pitch movement snapshot",
    movementItems: [
      { name: "Sprint repeat", detail: "30m sprint decay", value: "79" },
      { name: "Cut", detail: "90° plant-foot load", value: "82" },
      { name: "Strike", detail: "Plant + strike-foot sequencing", value: "84" },
      { name: "Recovery jog", detail: "HR recovery between sprints", value: "76" },
    ],
    motionTitle: "Soccer motion snapshot · strike sequencing",
    motionSubtitle: "Strike mechanics, sprint decay, cut load, and recovery between sprints.",
    framePill: "Strike 7 / Half",
    contactGrid: [
      { label: "Primary read", value: "Strike mechanics" },
      { label: "Sprint decay", value: "8% half-to-half" },
      { label: "Cut load", value: "Adductor watch" },
      { label: "Coach cue", value: "Sub if red" },
    ],
    metrics: [
      { label: "Strike mechanics", value: 84, unit: "/100", insight: "Plant-foot timing aligned with strike-foot motion supports clean contact." },
      { label: "Sprint repeatability", value: 79, unit: "/100", insight: "Peak sprint output decays beyond the 10% threshold after the 70th minute." },
      { label: "Cut load", value: 82, unit: "/100", insight: "90° cut force is in range; adductor strain risk remains low." },
    ],
    variants: [
      { label: "Outfield", detail: "Sprint decay, cut load, strike mechanics, and sub readiness." },
      { label: "Keeper", detail: "Reaction time, dive load, and recovery between actions." },
    ],
    insight: "Soccer load is read against minutes-played readiness so subs happen on biology, not the bench clock.",
  },
  {
    id: "squash",
    label: "Squash", emoji: "🥎",
    databaseLabel: "Court DB",
    databaseTitle: "Court coverage + player tendency database",
    databaseSubtitle: "Heat maps, court zones, critical-point shot tendencies, and opponent scouting.",
    databaseCards: [
      { title: "T-control %", metric: "Rally share on the T", detail: "Share of the rally you hold the dominant central court position.", value: 78 },
      { title: "Movement DB", metric: "Center-mark footwork", detail: "T → corner routes, steps, decel into position, and lead foot.", value: 84 },
      { title: "Opponent tendencies", metric: "Shot choice by zone", detail: "Favorite, target, and tell per zone for tagged opponents.", value: 80 },
      { title: "Critical-point reads", metric: "Pressure adaptation", detail: "How shot choices change at critical vs. non-critical points.", value: 76 },
    ],
    tendencyRows: [
      { zone: "T position · neutral", read: "Straight drive 41% · counter-drop 18%", pressure: "Baseline" },
      { zone: "Back-right under pressure", read: "Cross-court drive rises to 56%", pressure: "Adjustment" },
      { zone: "Match point · 10-10", read: "Volley straight + kill tendency to front-right", pressure: "Critical" },
      { zone: "Late game · Z5+", read: "Drop tendency increases as decel back to T slows", pressure: "Fatigue" },
    ],
    agilityTitle: "Squash agility score",
    agilitySummary: "Court coverage decomposed into burst, decel, change-of-direction, and return-to-T.",
    agilityComponents: [
      { label: "First-step burst", detail: "T split-step → first push", value: 88 },
      { label: "Acceleration", detail: "Drive phase to front/back corners", value: 86 },
      { label: "Deceleration", detail: "Brake into corner without over-running", value: 82 },
      { label: "Change of direction", detail: "Corner exit angle back to T", value: 84 },
      { label: "Return control", detail: "Return-to-T time + body balance", value: 79 },
      { label: "Repeatability", detail: "Burst quality across long rallies", value: 81 },
    ],
    performanceGroups: [
      { label: "Movement", status: "Elite band", value: 87, metrics: [{ label: "First-step burst", value: 88 }, { label: "Acceleration", value: 86 }] },
      { label: "Shot quality", status: "Elite band", value: 87, metrics: [{ label: "Racket head speed", value: 82 }, { label: "Ball force", value: 91 }] },
      { label: "Court positioning", status: "On target", value: 82, metrics: [{ label: "Change of direction", value: 84 }, { label: "Return control", value: 79 }] },
      { label: "Fatigue", status: "On target", value: 77, metrics: [{ label: "Session load", value: 71, warn: true }, { label: "Decay resistance", value: 82 }] },
      { label: "Tactical patterns", status: "On target", value: 78, metrics: [{ label: "Pattern read confidence", value: 80 }, { label: "Pressure adaptation", value: 76 }] },
      { label: "Readiness", status: "On target", value: 80, metrics: [{ label: "Live recovery", value: 78 }, { label: "Sport readiness", value: 82 }] },
    ],
    movementTitle: "T movement map",
    movementItems: [
      { name: "T → Back left", detail: "4 steps · 1.42s · decel 0.62g", value: "78" },
      { name: "T → Back right", detail: "4 steps · 1.36s · decel 0.71g", value: "82" },
      { name: "T → Front left", detail: "3 steps · 1.18s · decel 0.55g", value: "74" },
      { name: "T → Front right", detail: "3 steps · 1.12s · decel 0.61g", value: "80" },
      { name: "Crossover", detail: "Wide-to-wide recovery", value: "81" },
      { name: "Wide recovery", detail: "Wide → T return", value: "69" },
    ],
    routeMap: [
      { name: "T → Front Left",   firstStep: "2.1ft", steps: 3, rtT: "1.32s", score: 84, start: { x: 0.5, y: 0.55 }, end: { x: 0.25, y: 0.22 } },
      { name: "T → Back Right",   firstStep: "2.3ft", steps: 5, rtT: "1.58s", score: 83, start: { x: 0.5, y: 0.55 }, end: { x: 0.78, y: 0.85 } },
      { name: "T → Back Left",    firstStep: "2.4ft", steps: 4, rtT: "1.41s", score: 82, start: { x: 0.5, y: 0.55 }, end: { x: 0.22, y: 0.85 } },
      { name: "T → Front Right",  firstStep: "2.6ft", steps: 4, rtT: "1.21s", score: 81, start: { x: 0.5, y: 0.55 }, end: { x: 0.75, y: 0.22 } },
      { name: "Corner ↔ Corner",  firstStep: "2.7ft", steps: 2, rtT: "1.92s", score: 80, start: { x: 0.22, y: 0.82 }, end: { x: 0.78, y: 0.22 } },
      { name: "Lunge + Recovery", firstStep: "2.9ft", steps: 3, rtT: "1.18s", score: 79, start: { x: 0.5, y: 0.55 }, end: { x: 0.32, y: 0.32 } },
    ],
    routeMapFooter: "Technique layer separates raw athleticism from usable sport movement by tracking sequence timing, directional force, fatigue drift, and execution quality.",
    motionTitle: "Slow-motion shot view · racket focus",
    motionSubtitle: "Racket face, contact side, head speed, force, backswing, and follow-through.",
    framePill: "Frame 42 / Match",
    contactGrid: [
      { label: "Contact side", value: "Front string bed" },
      { label: "Face angle", value: "11° closed" },
      { label: "Contact point", value: "14 in. ahead" },
      { label: "Shot output", value: "Power + accuracy" },
    ],
    metrics: [
      { label: "Racket head speed", value: 82, unit: "mph", insight: "Peak speed shows up on compact backswing with early hip turn." },
      { label: "Ball force", value: 91, unit: "N", insight: "Highest force came from neutral racket face and contact just ahead of lead foot." },
      { label: "Contact quality", value: 87, unit: "/100", insight: "Best accuracy appears when contact point stays between 12-18 in. in front." },
      { label: "Backswing distance", value: 31, unit: "in", insight: "Power improves up to 31 in.; beyond that, accuracy drops late in rallies." },
      { label: "Follow-through distance", value: 42, unit: "in", insight: "Longer follow-through increases depth consistency without adding fatigue cost." },
      { label: "Racket height variance", value: 14, unit: "°", insight: "Lower variance creates the highest accuracy + power blend." },
    ],
    insight: "VYRO compares open vs closed racket face, contact point, head speed, force, backswing, follow-through, and racket height to identify the swing that creates power, accuracy, or the best combined profile.",
  },
  {
    id: "tennis",
    label: "Tennis", emoji: "🎾",
    databaseLabel: "Court DB",
    databaseTitle: "Court coverage + rally tendency database",
    databaseSubtitle: "Tennis court zones, wide-ball movement, serve-plus-one reads, and pressure-point shot profiles.",
    databaseCards: [
      { title: "Center-mark footwork", metric: "Recovery to ready", detail: "Step-length and recovery time back to the center mark.", value: 84 },
      { title: "Wide-ball movement", metric: "Sideline coverage", detail: "Diagonal and lateral coverage to the deep wide ball.", value: 80 },
      { title: "Serve + one", metric: "Pattern read", detail: "First-strike tendencies off serve and return.", value: 78 },
      { title: "Pressure-point profile", metric: "Critical reads", detail: "Shot tendency on 30-30, deuce, and break-point situations.", value: 82 },
    ],
    tendencyRows: [
      { zone: "Serve · ad court", read: "Slice wide 38% · body 22% · T 40%", pressure: "Baseline" },
      { zone: "Return · deuce court", read: "Crosscourt rebound rises to 56% under pace", pressure: "Adjustment" },
      { zone: "Break point · serving", read: "Spin first serve, plus-one forehand cross", pressure: "Critical" },
      { zone: "3rd set · 60+ min", read: "Drop-shot tendency rises as wide-ball recovery slows", pressure: "Fatigue" },
    ],
    agilityTitle: "Tennis agility score",
    agilitySummary: "Court coverage decomposed into burst, decel, change-of-direction, and recovery to center.",
    agilityComponents: [
      { label: "First-step burst", detail: "Split-step → first lateral push", value: 88 },
      { label: "Acceleration", detail: "First three steps to wide ball", value: 86 },
      { label: "Deceleration", detail: "Brake into open/closed stance", value: 82 },
      { label: "Change of direction", detail: "Recovery crossover back to center", value: 84 },
      { label: "Return control", detail: "Recovery to center mark + ready position", value: 79 },
      { label: "Repeatability", detail: "Burst quality across long rallies", value: 81 },
    ],
    movementTitle: "Center-mark movement map",
    movementItems: [
      { name: "Center → Deep wide-left", detail: "5 steps · 1.65s · decel 0.71g", value: "76" },
      { name: "Center → Deep wide-right", detail: "5 steps · 1.58s · decel 0.69g", value: "79" },
      { name: "Lateral wide-left", detail: "3 steps · 1.10s · decel 0.55g", value: "84" },
      { name: "Lateral wide-right", detail: "3 steps · 1.12s · decel 0.58g", value: "82" },
      { name: "Diagonal forward-left", detail: "4 steps · 1.32s · decel 0.61g", value: "81" },
      { name: "Short ball", detail: "2 steps · 0.74s · decel 0.42g", value: "88" },
    ],
    routeMap: [
      { name: "Center → Wide Left",     firstStep: "2.2ft", steps: 5, rtT: "1.65s", score: 84, start: { x: 0.5, y: 0.5 }, end: { x: 0.15, y: 0.5 } },
      { name: "Center → Wide Right",    firstStep: "2.3ft", steps: 5, rtT: "1.58s", score: 82, start: { x: 0.5, y: 0.5 }, end: { x: 0.85, y: 0.5 } },
      { name: "Center → Deep Backhand", firstStep: "2.5ft", steps: 5, rtT: "1.72s", score: 79, start: { x: 0.5, y: 0.5 }, end: { x: 0.22, y: 0.85 } },
      { name: "Center → Short Ball",    firstStep: "2.0ft", steps: 2, rtT: "0.94s", score: 88, start: { x: 0.5, y: 0.5 }, end: { x: 0.48, y: 0.22 } },
      { name: "Corner ↔ Corner",        firstStep: "2.7ft", steps: 5, rtT: "1.92s", score: 80, start: { x: 0.18, y: 0.82 }, end: { x: 0.82, y: 0.82 } },
      { name: "Approach + Recovery",    firstStep: "2.6ft", steps: 3, rtT: "1.34s", score: 81, start: { x: 0.5, y: 0.5 }, end: { x: 0.55, y: 0.25 } },
    ],
    routeMapFooter: "Technique layer separates raw athleticism from usable sport movement by tracking sequence timing, directional force, fatigue drift, and execution quality.",
    motionTitle: "Slow-motion stroke view · racket focus",
    motionSubtitle: "Racket face, contact side, head speed, force, backswing, and follow-through.",
    framePill: "Frame 42 / Rally",
    contactGrid: [
      { label: "Contact side", value: "Front string bed" },
      { label: "Face angle", value: "7° closed" },
      { label: "Contact point", value: "18 in. ahead" },
      { label: "Shot output", value: "Depth + margin" },
    ],
    metrics: [
      { label: "Racket head speed", value: 78, unit: "mph", insight: "Best pace comes when hip turn starts before the racket drop." },
      { label: "Ball force", value: 88, unit: "N", insight: "Force peaks when contact stays ahead of the lead hip." },
      { label: "Contact quality", value: 85, unit: "/100", insight: "Closed face with higher finish creates the safest power profile." },
      { label: "Backswing distance", value: 34, unit: "in", insight: "Shorter takeback improves return accuracy against pace." },
      { label: "Follow-through distance", value: 48, unit: "in", insight: "Full finish protects depth late in long rallies." },
      { label: "Racket height variance", value: 12, unit: "°", insight: "Lower racket path drift improves cross-court consistency." },
    ],
    insight: "VYRO carries the same swing-shape logic into tennis by comparing face angle, string-bed contact, path height, contact point, and follow-through against shot outcome.",
  },
];
