import type { WorkoutLog, WorkoutLogExercise } from "../types/Workout";
import { computeExerciseVolumeFromLoggedSets, normalizeExerciseName } from "./workoutMetrics";

export type TimeRangePreset = "4w" | "8w" | "3m" | "6m" | "all";

export function presetToStartMs(preset: TimeRangePreset, nowMs: number): number | null {
  if (preset === "all") return null;
  const d = new Date(nowMs);
  if (preset === "4w") d.setDate(d.getDate() - 28);
  else if (preset === "8w") d.setDate(d.getDate() - 56);
  else if (preset === "3m") d.setMonth(d.getMonth() - 3);
  else if (preset === "6m") d.setMonth(d.getMonth() - 6);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function logCompletedMs(log: WorkoutLog): number {
  const raw = (log as any).completedAt ?? (log as any).date;
  if (!raw) return 0;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : 0;
  }
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw?.toDate === "function") {
    try {
      const x = raw.toDate();
      return x instanceof Date ? x.getTime() : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

/** Epley estimated 1RM from one set. */
export function estimateEpley1RM(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return 0;
  if (!Number.isFinite(reps) || reps <= 0) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export function bestE1RMFromExercise(ex: WorkoutLogExercise): number {
  let best = 0;
  for (const s of ex.sets ?? []) {
    const w = s.weight;
    const r = s.reps;
    if (w == null || !Number.isFinite(w) || w <= 0) continue;
    if (!Number.isFinite(r) || r <= 0) continue;
    best = Math.max(best, estimateEpley1RM(w, r));
  }
  return best;
}

export function sessionVolumeForExercise(ex: WorkoutLogExercise): number {
  if (typeof ex.volume === "number" && Number.isFinite(ex.volume)) return ex.volume;
  return computeExerciseVolumeFromLoggedSets(ex.sets);
}

export function maxWeightFromExercise(ex: WorkoutLogExercise): number {
  let m = 0;
  for (const s of ex.sets ?? []) {
    if (s.weight != null && Number.isFinite(s.weight) && s.weight > m) m = s.weight;
  }
  return m;
}

export function startOfWeekMondayMs(ms: number): number {
  const d = new Date(ms);
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function weekLabel(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export type WeeklyPoint = {
  weekStartMs: number;
  label: string;
  value: number;
  isPr: boolean;
};

/**
 * Weekly max e1RM for one exercise (or best across all exercises if exerciseNorm is null).
 */
export function buildWeekly1RMSeries(
  logs: WorkoutLog[],
  exerciseNorm: string | null,
  rangeStartMs: number | null,
  nowMs: number
): WeeklyPoint[] {
  const filtered = logs
    .map((l) => ({ l, ms: logCompletedMs(l) }))
    .filter(({ ms }) => ms > 0 && ms <= nowMs)
    .filter(({ ms }) => (rangeStartMs == null ? true : ms >= rangeStartMs));

  const byWeek = new Map<number, { best: number; ms: number }>();

  for (const { l, ms } of filtered) {
    const wk = startOfWeekMondayMs(ms);
    let bestSession = 0;
    for (const ex of l.exercises ?? []) {
      const key = normalizeExerciseName(ex.name);
      if (exerciseNorm && key !== exerciseNorm) continue;
      bestSession = Math.max(bestSession, bestE1RMFromExercise(ex));
    }
    if (bestSession <= 0) continue;
    const cur = byWeek.get(wk);
    if (!cur || bestSession > cur.best) {
      byWeek.set(wk, { best: bestSession, ms: wk });
    }
  }

  const weeks = Array.from(byWeek.keys()).sort((a, b) => a - b);
  let runningMax = 0;
  const out: WeeklyPoint[] = [];
  for (const wk of weeks) {
    const v = byWeek.get(wk)!.best;
    const isPr = v > runningMax;
    if (v > runningMax) runningMax = v;
    out.push({
      weekStartMs: wk,
      label: weekLabel(wk),
      value: v,
      isPr,
    });
  }
  return out;
}

export type WeeklyVolLoad = {
  weekStartMs: number;
  label: string;
  volume: number;
  avgLoad: number;
};

export function buildWeeklyVolumeVsLoad(
  logs: WorkoutLog[],
  exerciseNorm: string | null,
  rangeStartMs: number | null,
  nowMs: number
): WeeklyVolLoad[] {
  const filtered = logs
    .map((l) => ({ l, ms: logCompletedMs(l) }))
    .filter(({ ms }) => ms > 0 && ms <= nowMs)
    .filter(({ ms }) => (rangeStartMs == null ? true : ms >= rangeStartMs));

  type Agg = { vol: number; loads: number[]; wk: number };
  const map = new Map<number, Agg>();

  for (const { l, ms } of filtered) {
    const wk = startOfWeekMondayMs(ms);
    let vol = 0;
    const loads: number[] = [];
    for (const ex of l.exercises ?? []) {
      const key = normalizeExerciseName(ex.name);
      if (exerciseNorm && key !== exerciseNorm) continue;
      vol += sessionVolumeForExercise(ex);
      const mw = maxWeightFromExercise(ex);
      if (mw > 0) loads.push(mw);
    }
    if (vol <= 0 && loads.length === 0) continue;
    const cur = map.get(wk) ?? { vol: 0, loads: [], wk };
    cur.vol += vol;
    cur.loads.push(...loads);
    map.set(wk, cur);
  }

  const weeks = Array.from(map.keys()).sort((a, b) => a - b);
  return weeks.map((wk) => {
    const a = map.get(wk)!;
    const avgLoad =
      a.loads.length > 0 ? Math.round((a.loads.reduce((s, x) => s + x, 0) / a.loads.length) * 10) / 10 : 0;
    return {
      weekStartMs: wk,
      label: weekLabel(wk),
      volume: Math.round(a.vol),
      avgLoad,
    };
  });
}

export function collectExerciseNames(logs: WorkoutLog[]): string[] {
  const set = new Set<string>();
  for (const l of logs) {
    for (const ex of l.exercises ?? []) {
      const n = String(ex.name ?? "").trim();
      if (n) set.add(n);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function averageRpeFromLogs(logs: WorkoutLog[], exerciseNorm: string | null, rangeStartMs: number | null, nowMs: number): number | null {
  const vals: number[] = [];
  for (const l of logs) {
    const ms = logCompletedMs(l);
    if (ms <= 0 || ms > nowMs) continue;
    if (rangeStartMs != null && ms < rangeStartMs) continue;
    for (const ex of l.exercises ?? []) {
      const key = normalizeExerciseName(ex.name);
      if (exerciseNorm && key !== exerciseNorm) continue;
      const r = ex.rpe;
      if (r != null && Number.isFinite(r) && r > 0) vals.push(Number(r));
    }
  }
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export function totalVolumeFromLogs(logs: WorkoutLog[], exerciseNorm: string | null, rangeStartMs: number | null, nowMs: number): number {
  let t = 0;
  for (const l of logs) {
    const ms = logCompletedMs(l);
    if (ms <= 0 || ms > nowMs) continue;
    if (rangeStartMs != null && ms < rangeStartMs) continue;
    if (exerciseNorm) {
      for (const ex of l.exercises ?? []) {
        if (normalizeExerciseName(ex.name) !== exerciseNorm) continue;
        t += sessionVolumeForExercise(ex);
      }
    } else {
      const tv = typeof l.totalVolume === "number" && Number.isFinite(l.totalVolume) ? l.totalVolume : null;
      if (tv != null && tv > 0) t += tv;
      else {
        for (const ex of l.exercises ?? []) {
          t += sessionVolumeForExercise(ex);
        }
      }
    }
  }
  return Math.round(t * 100) / 100;
}

export function peakE1RMFromLogs(logs: WorkoutLog[], exerciseNorm: string | null, rangeStartMs: number | null, nowMs: number): number {
  let best = 0;
  for (const l of logs) {
    const ms = logCompletedMs(l);
    if (ms <= 0 || ms > nowMs) continue;
    if (rangeStartMs != null && ms < rangeStartMs) continue;
    for (const ex of l.exercises ?? []) {
      if (exerciseNorm && normalizeExerciseName(ex.name) !== exerciseNorm) continue;
      best = Math.max(best, bestE1RMFromExercise(ex));
    }
  }
  return Math.round(best * 10) / 10;
}

export type KpiDelta = { current: number; previous: number; delta: number; deltaPct: number | null };

export function comparePeriods(
  currentLogs: WorkoutLog[],
  previousLogs: WorkoutLog[],
  exerciseNorm: string | null,
  metric: "e1rm" | "volume" | "rpe"
): KpiDelta {
  const now = Date.now();
  const cur =
    metric === "e1rm"
      ? peakE1RMFromLogs(currentLogs, exerciseNorm, null, now)
      : metric === "volume"
        ? totalVolumeFromLogs(currentLogs, exerciseNorm, null, now)
        : averageRpeFromLogs(currentLogs, exerciseNorm, null, now) ?? 0;
  const prev =
    metric === "e1rm"
      ? peakE1RMFromLogs(previousLogs, exerciseNorm, null, now)
      : metric === "volume"
        ? totalVolumeFromLogs(previousLogs, exerciseNorm, null, now)
        : averageRpeFromLogs(previousLogs, exerciseNorm, null, now) ?? 0;
  const delta = Math.round((cur - prev) * 10) / 10;
  const deltaPct =
    prev !== 0 && Number.isFinite(prev) ? Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10 : null;
  return { current: cur, previous: prev, delta, deltaPct };
}

export function splitLogsByPeriod(
  logs: WorkoutLog[],
  rangeStartMs: number,
  nowMs: number
): { current: WorkoutLog[]; previous: WorkoutLog[] } {
  const len = nowMs - rangeStartMs;
  const prevStart = rangeStartMs - len;
  const current = logs.filter((l) => {
    const ms = logCompletedMs(l);
    return ms >= rangeStartMs && ms <= nowMs;
  });
  const previous = logs.filter((l) => {
    const ms = logCompletedMs(l);
    return ms >= prevStart && ms < rangeStartMs;
  });
  return { current, previous };
}

/** Compliance %: sessions in last 7 days vs target frequency. */
export function compliancePercentFromLogs(logs: WorkoutLog[], workoutsPerWeek: number, nowMs: number): number | null {
  if (!workoutsPerWeek || workoutsPerWeek <= 0) return null;
  const weekAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
  const count = logs.filter((l) => {
    const ms = logCompletedMs(l);
    return ms >= weekAgo && ms <= nowMs;
  }).length;
  return Math.max(0, Math.min(100, Math.round((count / workoutsPerWeek) * 100)));
}

export function complianceDelta(prevWeekCount: number, thisWeekCount: number, target: number): number {
  if (target <= 0) return 0;
  const prevPct = Math.min(100, Math.round((prevWeekCount / target) * 100));
  const thisPct = Math.min(100, Math.round((thisWeekCount / target) * 100));
  return thisPct - prevPct;
}

export function sessionsInRollingWindow(logs: WorkoutLog[], startMs: number, endMs: number): number {
  return logs.filter((l) => {
    const ms = logCompletedMs(l);
    return ms >= startMs && ms <= endMs;
  }).length;
}

export type ExerciseInsight = {
  bestSetEver: string;
  lastPrDate: string | null;
  topVolumeWeek: string;
  avgReps: number | null;
  avgWeeklyFrequency: number | null;
};

export function buildExerciseInsights(
  logs: WorkoutLog[],
  exerciseNorm: string,
  rangeStartMs: number | null,
  nowMs: number
): ExerciseInsight | null {
  if (!exerciseNorm) return null;
  let bestWeight = 0;
  let bestReps = 0;
  let lastPrMs: number | null = null;
  let runningMax = 0;

  const weeklyVol = new Map<number, number>();

  const repsSamples: number[] = [];
  const weeksWithSession = new Set<number>();

  const sorted = [...logs]
    .map((l) => ({ l, ms: logCompletedMs(l) }))
    .filter(({ ms }) => ms > 0 && ms <= nowMs)
    .filter(({ ms }) => (rangeStartMs == null ? true : ms >= rangeStartMs))
    .sort((a, b) => a.ms - b.ms);

  for (const { l, ms } of sorted) {
    for (const ex of l.exercises ?? []) {
      if (normalizeExerciseName(ex.name) !== exerciseNorm) continue;
      const e1 = bestE1RMFromExercise(ex);
      for (const s of ex.sets ?? []) {
        if (s.weight != null && s.reps != null && s.weight > 0 && s.reps > 0) {
          repsSamples.push(s.reps);
          if (s.weight > bestWeight || (s.weight === bestWeight && s.reps > bestReps)) {
            bestWeight = s.weight;
            bestReps = s.reps;
          }
        }
      }
      if (e1 > runningMax) {
        runningMax = e1;
        lastPrMs = ms;
      }
      const wk = startOfWeekMondayMs(ms);
      weeksWithSession.add(wk);
      weeklyVol.set(wk, (weeklyVol.get(wk) ?? 0) + sessionVolumeForExercise(ex));
    }
  }

  let topWeek = 0;
  let topVol = 0;
  for (const [wk, v] of weeklyVol) {
    if (v > topVol) {
      topVol = v;
      topWeek = wk;
    }
  }

  const rangeWeeks =
    rangeStartMs != null ? Math.max(1, Math.ceil((nowMs - rangeStartMs) / (7 * 24 * 60 * 60 * 1000))) : Math.max(1, weeksWithSession.size);
  const avgWeeklyFrequency = weeksWithSession.size > 0 ? Math.round((weeksWithSession.size / rangeWeeks) * 100) / 100 : null;

  const avgReps =
    repsSamples.length > 0
      ? Math.round((repsSamples.reduce((a, b) => a + b, 0) / repsSamples.length) * 10) / 10
      : null;

  return {
    bestSetEver: bestWeight > 0 ? `${bestWeight} kg × ${bestReps}` : "—",
    lastPrDate: lastPrMs ? new Date(lastPrMs).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null,
    topVolumeWeek: topVol > 0 ? `${weekLabel(topWeek)} (${Math.round(topVol)} kg·reps)` : "—",
    avgReps,
    avgWeeklyFrequency,
  };
}

export type CoachingSignal = { text: string; status: "green" | "yellow" | "red" };

export function buildCoachingSignals(
  weekly1RM: WeeklyPoint[],
  volLoad: WeeklyVolLoad[],
  compliancePct: number | null,
  compliancePrevDelta: number | null
): CoachingSignal[] {
  const out: CoachingSignal[] = [];

  if (weekly1RM.length >= 4) {
    const first = weekly1RM.slice(0, Math.ceil(weekly1RM.length / 3));
    const last = weekly1RM.slice(-Math.ceil(weekly1RM.length / 3));
    const a1 = first.reduce((s, p) => s + p.value, 0) / first.length;
    const a2 = last.reduce((s, p) => s + p.value, 0) / last.length;
    if (a2 > a1 * 1.03) {
      out.push({ text: "Strength trending up recently", status: "green" });
    } else if (a2 < a1 * 0.97) {
      out.push({ text: "Strength may be flattening", status: "yellow" });
    }
  }

  if (volLoad.length >= 3) {
    const vols = volLoad.map((x) => x.volume);
    const loads = volLoad.map((x) => x.avgLoad);
    const vTrend = vols[vols.length - 1] - vols[0];
    const lTrend = loads[loads.length - 1] - loads[0];
    if (Math.abs(vTrend) < vols[0] * 0.05 && lTrend > loads[0] * 0.05) {
      out.push({ text: "Volume stable but intensity rising", status: "yellow" });
    }
  }

  if (weekly1RM.length >= 5) {
    const tail = weekly1RM.slice(-3).map((x) => x.value);
    const spread = Math.max(...tail) - Math.min(...tail);
    const mid = tail.reduce((a, b) => a + b, 0) / tail.length;
    if (mid > 0 && spread / mid < 0.02) {
      out.push({ text: "Possible plateau in strength", status: "yellow" });
    }
  }

  if (compliancePrevDelta != null && compliancePrevDelta < -10) {
    out.push({ text: "Compliance dropped vs prior week", status: "red" });
  } else if (compliancePct != null && compliancePct >= 80) {
    out.push({ text: "Compliance on target", status: "green" });
  }

  if (out.length === 0) {
    out.push({ text: "Keep collecting logs for richer insights", status: "yellow" });
  }

  return out.slice(0, 5);
}
