import {
  presetToStartMs,
  buildWeeklyWeightRepsSeries,
  buildWeekly1RMSeries,
  estimateEpley1RM,
} from "../../utils/coachProgressAnalytics";
import type { WorkoutLog, WorkoutLogExercise } from "../../types/Workout";

const ex = (name: string, sets: { reps: number; weight: number }[]): WorkoutLogExercise => ({
  name,
  repsPlanned: "8",
  sets: sets.map((s, i) => ({ setNumber: i + 1, reps: s.reps, weight: s.weight })),
  rest: "90",
  tempo: "",
  rpe: 7,
});

const log = (id: string, completedAt: Date, exercises: WorkoutLogExercise[]): WorkoutLog => ({
  id,
  studentId: "student-1",
  workoutPlanId: "plan-1",
  workoutName: "Push Day",
  exercises,
  completedAt,
});

describe("presetToStartMs", () => {
  const now = new Date("2026-07-22T12:00:00Z").getTime();

  it("2w goes back 14 days", () => {
    const start = presetToStartMs("2w", now);
    expect(start).not.toBeNull();
    expect(now - (start as number)).toBeGreaterThanOrEqual(14 * 24 * 60 * 60 * 1000 - 1000);
    expect(now - (start as number)).toBeLessThan(15 * 24 * 60 * 60 * 1000);
  });

  it("1m goes back one calendar month", () => {
    const start = presetToStartMs("1m", now);
    const d = new Date(start as number);
    expect(d.getUTCMonth()).toBe(new Date(now).getUTCMonth() - 1 + (new Date(now).getUTCMonth() === 0 ? 12 : 0));
  });

  it("3m goes back three calendar months", () => {
    const start = presetToStartMs("3m", now);
    const expected = new Date(now);
    expected.setMonth(expected.getMonth() - 3);
    expected.setHours(0, 0, 0, 0);
    expect(start).toBe(expected.getTime());
  });

  it("all returns null", () => {
    expect(presetToStartMs("all", now)).toBeNull();
  });
});

describe("buildWeeklyWeightRepsSeries", () => {
  it("picks the set with the best e1RM per week and returns its raw weight/reps", () => {
    const now = new Date("2026-07-22T12:00:00Z").getTime();
    const logs: WorkoutLog[] = [
      log("l1", new Date("2026-07-06T10:00:00Z"), [
        ex("Bench Press", [
          { reps: 8, weight: 100 }, // e1RM ~126.7
          { reps: 5, weight: 110 }, // e1RM ~128.3 (best of week 1)
        ]),
      ]),
      log("l2", new Date("2026-07-13T10:00:00Z"), [
        ex("Bench Press", [
          { reps: 6, weight: 115 }, // e1RM ~138 (best of week 2)
        ]),
      ]),
    ];

    const series = buildWeeklyWeightRepsSeries(logs, "bench press", null, now);
    expect(series).toHaveLength(2);
    expect(series[0]).toMatchObject({ weight: 110, reps: 5 });
    expect(series[1]).toMatchObject({ weight: 115, reps: 6 });

    // Sanity: the picked pair really is the max e1RM for its week among all sets logged that week.
    const week1Sets = [
      { weight: 100, reps: 8 },
      { weight: 110, reps: 5 },
    ];
    const bestWeek1 = week1Sets.reduce((best, s) => {
      const e1 = estimateEpley1RM(s.weight, s.reps);
      return e1 > estimateEpley1RM(best.weight, best.reps) ? s : best;
    });
    expect(series[0].weight).toBe(bestWeek1.weight);
    expect(series[0].reps).toBe(bestWeek1.reps);
  });

  it("matches the same weekly winner as the 1RM chart series", () => {
    const now = new Date("2026-07-22T12:00:00Z").getTime();
    const logs: WorkoutLog[] = [
      log("l1", new Date("2026-07-06T10:00:00Z"), [
        ex("Squat", [
          { reps: 10, weight: 80 },
          { reps: 3, weight: 120 },
        ]),
      ]),
    ];
    const oneRm = buildWeekly1RMSeries(logs, "squat", null, now);
    const weightReps = buildWeeklyWeightRepsSeries(logs, "squat", null, now);
    expect(weightReps).toHaveLength(1);
    expect(estimateEpley1RM(weightReps[0].weight, weightReps[0].reps)).toBeCloseTo(oneRm[0].value, 1);
  });

  it("returns an empty series when there is no valid weight/reps data", () => {
    const now = Date.now();
    expect(buildWeeklyWeightRepsSeries([], null, null, now)).toEqual([]);
  });
});
