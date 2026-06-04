# Mentorix — Progress tab redesign plan

This document lays out a phased redesign of the Progress tab for the three user roles (coach, student, athlete) so the screen actually communicates "am I getting stronger / staying consistent / hitting PRs?" at a glance.

Tech baseline: you already have `react-native-svg`, `react-native-reanimated`, and a substantial analytics module (`utils/coachProgressAnalytics.ts`) with E1RM estimation, weekly volume series, period comparison, exercise insights, and coaching signals. The infrastructure is here — the UI just doesn't surface it well enough.

---

## 1. What's strong today and what's weak

### Strong (keep)

- `coachProgressAnalytics.ts` has 460 lines of solid primitives: `estimateEpley1RM`, `buildWeekly1RMSeries`, `buildWeeklyVolumeVsLoad`, `comparePeriods`, `splitLogsByPeriod`, `buildExerciseInsights`, `buildCoachingSignals`.
- `ProgressCharts.tsx` provides `MiniLineChart`, `DualLineChart`, `KpiCard`. SVG-based, no heavy dependencies.
- Time-range model (`4w / 8w / 3m / 6m / all`) is consistent and reused.
- Coach view already supports student selection + exercise filter.

### Weak (fix in this redesign)

- **No hero stat.** The screen opens with filters and a chart. The user has to actively read to know if things are going well. Premium fitness apps open with one big number + a delta.
- **"Volume vs intensity" dual line chart** is information-dense but the average user can't read it. Two y-axes is a known UX pitfall. Better split into two clean visuals.
- **No consistency view.** "Did I show up?" is a more important question for most non-elite users than "is my 1RM up?". A heatmap calendar is the right tool and missing.
- **PRs aren't celebrated.** PR detection exists in the data (`isPr` flag on logged exercises) but there's no PR timeline or count anywhere.
- **No muscle/body coverage view.** Users can't tell at a glance if they've been hitting upper body, lower body, etc.
- **Coach view doesn't have a roster overview.** Coach has to pick a student to see anything. They need a roll-up first: "5 students lagging this week, 12 on track."
- **Coaching signals text-only.** Red/yellow/green markers exist as text bullets — should be visually emphasized.
- **No empty / pre-data state design.** Currently a "No progress data yet" generic message. Premium feel demands a designed empty state with sample data or a clear path to first workout.

---

## 2. Per-role goals — what each user actually wants to know

### Student / athlete (same view; "athlete" is just a label variant)

Top three questions, in order of importance:
1. **Am I consistent?** (Did I show up this week? Am I on track for my target?)
2. **Am I getting stronger?** (Are my lifts going up? Did I hit any PRs lately?)
3. **What should I focus on?** (Where am I plateauing or regressing?)

### Coach

Top three questions:
1. **Who needs my attention right now?** (Lagging students, missed sessions, workouts awaiting feedback.)
2. **How's the roster doing overall?** (Aggregate compliance, total PRs this month, average session count.)
3. **For a specific student: how are they progressing?** (The existing per-student view — keep it.)

---

## 3. Proposed layout — Student / Athlete

Six sections, top-to-bottom. Each is independently scrollable as a block so the user can stop reading whenever they get the answer they came for.

### 3.1 Hero KPI band (top, 25-30% of viewport)

Three cards in a row at the top of the screen:

| Card | Number | Delta vs previous period |
|---|---|---|
| **Streak** | Current consecutive-week streak | "3 weeks" with ↑/↓ vs last month |
| **Sessions this week** | Count this week | "4 / 4" against weekly target — with a tiny ring fill |
| **Volume** | Total volume this period | "32,400 kg" with "+18%" delta (lime if up, neutral if flat, red if down) |

Tap any card to expand its history view (modal or sheet).

**Why this works:** every premium fitness app does this. The user gets the answer to "how am I doing?" before reading a single chart.

**Already computable** with: `sessionsInRollingWindow`, `compliancePercentFromLogs`, `totalVolumeFromLogs`, `comparePeriods`.

### 3.2 Consistency heatmap

A 12-week calendar grid (84 cells, ~7 wide × 12 tall, or 7 days wide × 12 weeks). Each cell = one day. Color intensity:
- Empty (gray, hairline border) = no session
- Single workout = lime, low opacity
- Multiple workouts that day = lime, higher opacity

Above the grid: caption "Last 12 weeks · {N} sessions". Tap a cell to see what was logged that day.

**Why this works:** GitHub-contributions-style heatmaps are universally understood. They make consistency visceral — gaps are immediately obvious. The History tab already has this for one month; the Progress version is a longer-range view (3 months).

**Already computable** by extending `countsByDay` logic from the History hook.

### 3.3 Strength progression (per-exercise sparklines)

Replace the current "1RM progression" big chart with a stack of **small sparklines, one per main lift**, similar to Strava's "Suggested workouts" cards.

Layout: a vertical list of cards. Each card:
- Exercise name on the left (e.g., "Bench press")
- Big estimated-1RM number (e.g., "92.5 kg") with delta ("+5 kg this month" in lime)
- 60-day sparkline on the right (small line, 40px tall, lime stroke, dot on the latest point)
- Tap for full-screen detail (existing big `MiniLineChart`)

Show the top 5–8 lifts by session frequency. "Show all (12)" link at the bottom.

**Why this works:** users scan multiple lifts at once instead of paginating an exercise picker. The user sees their bench, squat, deadlift, pull-up, and OHP progress simultaneously. The big number + delta delivers the answer; the sparkline confirms the trend.

**Already computable** with: `collectExerciseNames`, `peakE1RMFromLogs`, `buildWeekly1RMSeries` per exercise.

### 3.4 Volume by week (bar chart)

A simple 12-bar weekly bar chart, lime fill. Y-axis = total volume (kg). X-axis = week labels (e.g., "Mar 3", "Mar 10", …).

A horizontal dashed line marks the average across the period.

Optional: hover/tap a bar to see the breakdown (sessions count + total kg).

**Why this works:** bar charts are the universal "showed up this much" visual. Pairs with the heatmap (consistency in days vs consistency in load).

**Already computable** with: `buildWeeklyVolumeVsLoad` — drop the second series.

### 3.5 Recent PRs (timeline)

A horizontal scrollable list of PR cards from the period. Each card:
- Date ("Apr 14")
- Exercise + new record ("Deadlift — 150 kg")
- Tiny icon (trophy / lightning bolt)
- Lime border

Empty state: "No PRs yet this period. Keep pushing."

**Why this works:** PRs are emotionally charged moments. Showing them visually rewards the user for the work. Most fitness apps under-celebrate these.

**Already in data** — `isPr` flag on `WorkoutLogExercise`. Walk the logs in the range and collect.

### 3.6 Coaching signals + actionable insights

Keep the existing `buildCoachingSignals` output but visualize it better:
- A row of three colored chips at the top: green count / yellow count / red count.
- Below: signal cards with the signal text, color-coded left border (4px wide).
- Tap a red/yellow signal to drill into the exercise it concerns.

Add 2–3 more signals worth computing:
- **"Bench press hasn't grown in 3 weeks"** (1RM plateau detection — flat slope on the weekly series).
- **"You've logged 3 sessions this week vs your target of 4"** (compliance signal — already partly there).
- **"You've doubled your back volume this month"** (volume surge by muscle group — needs muscle-group mapping; see Section 6).

---

## 4. Proposed layout — Coach

Reorder the existing screen: open with a roster overview, drill into a single student only when the coach taps in.

### 4.1 Roster summary band (top)

Three cards in a row:

| Card | Number | Delta |
|---|---|---|
| **Active students** | Count with logged sessions in last 14 days | "12 of 15" |
| **Compliance** | % of roster on track this week | "73%" with ↑/↓ vs last week |
| **PRs this period** | Total PR count across roster | "8 PRs" with delta |

### 4.2 Attention list

A list of students sorted by "needs attention" score, top 5 visible, "Show more" expands.

Each row:
- Student avatar (using the new `<Avatar>` component) + name on the left
- Status pill: "Lagging" (red), "Slipping" (yellow), "On track" (green)
- Sparkline of their last-8-weeks session count on the right
- Tap → drills into existing `ProgressAnalyticsView` for that student

"Needs attention" score = `target sessions per week × 2 - actual sessions in last 2 weeks`. Higher = more attention needed.

### 4.3 Roster leaderboard (optional collapse-by-default)

Top-N by:
- Most consistent (streak)
- Most PRs this period
- Biggest volume gain vs last period

Each row shows the metric value + tiny sparkline. Lighter visual weight than the attention list — coaches likely care more about who's struggling than who's winning.

### 4.4 Workouts awaiting feedback

A horizontal scrollable list of recently completed workouts where `coachFeedback` is empty. Each card:
- Student avatar + name
- Workout name
- "2 days ago"
- Tap → opens that workout log in the existing feedback flow

This is high-leverage: it converts the Progress tab into a coach productivity tool. Coaches will check it daily.

### 4.5 Per-student deep-dive (existing view, restructured)

When the coach taps a student, the existing `ProgressAnalyticsView` (with 1RM chart, exercise insights, coaching signals) is what they see — but it should adopt the same hero/cards/sparklines layout as the student view, so it's consistent.

---

## 5. Visualization choices — what to use where

| Need | Visual | Why |
|---|---|---|
| KPI with trend | Big number + delta arrow | Fastest read, emotionally clear |
| Consistency over time | Heatmap calendar (12 weeks × 7 days) | Universal language, gaps obvious |
| Single metric trend | Sparkline (40px tall, no axes) | Compresses 12 weeks into a glance |
| Weekly compare | Vertical bar chart | Simple, period-over-period clear |
| Multi-metric balance | Avoid radar/spider — replace with stacked horizontal bars | Radar is hard to read on phones |
| PR moments | Timeline cards with badges | Celebration framing |
| Status (good/bad/concerning) | Color-coded pills (lime / amber / red) + left-border accent on cards | Scannable in a long list |
| Body coverage | Muscle group stacked bar (NOT a body silhouette diagram in v1) | Bars beat diagrams for "did I train enough back?" — diagrams are nice-to-have v2 |

**What to avoid:**

- Pie charts — never readable at this size, can't compare slices.
- Radar / spider charts — look impressive on dashboards, fail on phone screens. People can't tell if one axis is 60 or 80.
- Dual-axis line charts — the existing "volume vs intensity" two-line chart should be split.
- 3D / depth effects — slows render, looks dated, communicates nothing.

---

## 6. Data we'd need to add

Most of the analytics already exist. A few additions:

### 6.1 Muscle group mapping

Add `utils/muscleGroups.ts` with a function `getMuscleGroups(exerciseName: string): string[]` that maps common exercise names to one or more muscle groups (chest, back, legs, shoulders, arms, core, cardio). Use a keyword approach similar to `utils/workoutCategorize.ts` — no ML, just heuristics like "bench → chest", "squat → legs". Defaults to "other".

Used by: Section 3.6 (volume surge by group), and optionally a Section 3.7 muscle group bar.

### 6.2 PR collector

Add `collectPRsInRange(logs, rangeStartMs, rangeEndMs): PRSummary[]` to `coachProgressAnalytics.ts`. Walks every log, finds exercises where `isPr === true`, returns `{ exerciseName, weightKg, reps, completedAtMs, logId }[]`.

Used by: Section 3.5 (Recent PRs timeline).

### 6.3 Plateau detector

Add `detectPlateau(series, weeksWithoutGain = 3): { plateau: boolean; lastGainMs: number | null }`. Walks the weekly 1RM series for a given exercise; if no new high in N weeks, return `plateau: true`.

Used by: Section 3.6 (extra coaching signal).

### 6.4 Roster aggregator (coach)

Add `utils/rosterAggregates.ts`:
- `computeRosterCompliance(students, logsByStudent, weeklyTargetByStudent, nowMs): { compliantCount, total, percentile }`
- `computeAttentionScore(student, logs, weeklyTarget, nowMs): number`
- `collectRosterPRs(logsByStudent, rangeStartMs, rangeEndMs): PRSummary[]`

Used by: Sections 4.1, 4.2, 4.3.

### 6.5 Awaiting feedback (coach)

Add to `workoutService`: `getLogsAwaitingFeedback(coachId, limit = 20): Promise<WorkoutLog[]>`. Queries `workoutLogs` where `coachId == X` and `coachFeedback` is missing/empty, ordered by `completedAt desc`.

This requires a Firestore composite index — add to `firestore.indexes.json`.

Used by: Section 4.4.

---

## 7. Empty / pre-data states

Three states to design explicitly, not punt with generic text:

- **No workouts logged yet** — explain what unlocks when they log their first session; CTA to "Start a workout" linking to the workouts tab.
- **Only 1 session logged** — show the single session with messaging like "First session logged. Charts unlock after 2 sessions, PRs after your second time hitting each exercise."
- **Range too short** — if the user picks "4w" but only has 5 days of data, show the same data with a "Not enough data for full charts yet — log 3 more sessions to unlock trends" message.

Make the empty state visually rich (use one of the existing icons + a clear next-step button). Premium fitness apps treat empty states as marketing opportunities.

---

## 8. Implementation phases

This is too much for one prompt. Split into four branches, in this order:

### Phase A — Foundation (1 branch)

- Add `collectPRsInRange`, `detectPlateau`, muscle-group util, attention-score util.
- Add Firestore index for "awaiting feedback" query.
- Extract reusable visual components: `<HeroKpiCard>`, `<Sparkline>`, `<WeekBars>`, `<ConsistencyHeatmap>`, `<PrTimelineCard>`, `<StatusPill>`.
- Don't change the screens yet. Just ship the toolkit + Storybook-like demo page (optional) so the rest is mechanical.

### Phase B — Student / athlete Progress redesign (1 branch)

- Restructure `app/student/progress.tsx` (and the athlete variant if it diverges) into the 6-section layout.
- Wire up the new components against existing analytics. Most of the math already exists.
- Empty / partial-data states.

### Phase C — Coach Progress redesign (1 branch)

- Restructure `app/coach/(tabs)/progress.tsx`: roster summary band + attention list + leaderboard + awaiting-feedback list.
- Tap-into-student still uses the existing `ProgressAnalyticsView` (which gets restyled in Phase D).
- Add the per-coach service queries.

### Phase D — Per-student deep-dive restyle + final polish (1 branch)

- Migrate the existing `ProgressAnalyticsView` to use the new visual components so coach-drill-down looks like the student view.
- Animations: subtle entry transitions on hero cards (Reanimated `FadeInDown`), sparkline draw-on-mount.
- Accessibility pass (labels, color-contrast on the lime/dark palette).

---

## 9. What this is NOT

Things to deliberately skip in v1 to keep the redesign shippable:

- **Body silhouette diagrams** — pretty but engineering-heavy. Bar charts deliver 80% of the "did I train this muscle group?" answer in 10% of the work.
- **Goal-setting flows** — user picks a weekly target somewhere else (already in DB? add later). Progress just visualizes against the target.
- **Comparing your stats to other users** — privacy-touchy, scope creep.
- **Export / share to social** — nice but not core to "did I improve?" question.
- **Wearable / HRV / sleep integration** — different scope entirely.
- **AI insights ("Claude says you should…")** — defer until the manual coaching-signals approach has proven that users read insights at all.

---

## 10. Open decisions for you

Before I write any Cursor prompts, I need decisions on:

1. **Which charts library do we want for the new charts** — stay on hand-rolled SVG (matches what's there, but slower to build), or pull in **Victory Native** / **Recharts-via-react-native-web**? My honest take: stay on hand-rolled. SVG primitives are already there; the chart types we need (sparklines, bars, heatmaps) are all <50 lines each. A library is overkill and adds bundle weight.

2. **Athlete vs student — same view, different copy, or actually different?** Currently `app/student/(tabs)/progress.tsx` is 42 bytes (looks like a re-export). Confirm whether "athlete" is a future role or just a label.

3. **Muscle-group taxonomy** — the simple list (chest / back / legs / shoulders / arms / core / cardio) or finer (pecs / lats / quads / hams / glutes / etc.)? My recommendation: ship coarse first (7 buckets), refine if users ask.

4. **Coach roster size assumptions** — what's the realistic max number of students per coach? If it's <30, the attention list + leaderboard can render everyone in a scrollable view. If it could grow to hundreds, pagination is required.

5. **Weekly target source** — where is the student's weekly target stored? `workoutsPerWeek` is on `TrainingGroup`. If a student has multiple groups, which one's target applies? Pick: group-with-latest-activity, or sum.

Once those are answered, I'll write Phase A's Cursor prompt (the foundation toolkit), then B/C/D as separate prompts each ~the size of the photo-upload prompt.
