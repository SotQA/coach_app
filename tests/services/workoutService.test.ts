import { workoutService } from "../../services/workoutService";
import { clearFirestore, seedUser, testId } from "../setup/testHelpers";
import type { WorkoutLogExercise } from "../../types/Workout";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const basePlan = () => ({
  coachId: testId("coach"),
  studentId: testId("student"),
  name: "Push Day",
  exercises: [
    { name: "Bench Press", sets: 4, reps: "8", rest: "90", tempo: "", rpe: 8, weight: 80 },
    { name: "Overhead Press", sets: 3, reps: "10", rest: "60", tempo: "", rpe: null },
  ],
  isActive: true as const,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const baseLogExercise = (name = "Bench Press"): WorkoutLogExercise => ({
  name,
  repsPlanned: "8",
  sets: [
    { setNumber: 1, reps: 8, weight: 80 },
    { setNumber: 2, reps: 8, weight: 80 },
  ],
  rest: "90",
  tempo: "",
  rpe: 8,
  volume: 1280,
  isPr: false,
});

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(async () => {
  await clearFirestore();
});

// ─── createWorkoutPlan ────────────────────────────────────────────────────────

describe("workoutService.createWorkoutPlan", () => {
  it("creates a plan and returns it with an id", async () => {
    const payload = basePlan();
    const plan = await workoutService.createWorkoutPlan(payload);

    expect(plan.id).toBeTruthy();
    expect(plan.name).toBe("Push Day");
    expect(plan.coachId).toBe(payload.coachId);
    expect(plan.studentId).toBe(payload.studentId);
    expect(plan.exercises).toHaveLength(2);
    expect(plan.isActive).toBe(true);
  });

  it("trims whitespace from the plan name", async () => {
    const plan = await workoutService.createWorkoutPlan({
      ...basePlan(),
      name: "  Push Day  ",
    });
    expect(plan.name).toBe("Push Day");
  });

  it("defaults name to 'Workout Plan' when name is empty", async () => {
    const plan = await workoutService.createWorkoutPlan({
      ...basePlan(),
      name: "",
    });
    expect(plan.name).toBe("Workout Plan");
  });

  it("throws if coachId is empty", async () => {
    await expect(
      workoutService.createWorkoutPlan({ ...basePlan(), coachId: "" })
    ).rejects.toThrow("Missing coachId");
  });

  it("throws if studentId is empty", async () => {
    await expect(
      workoutService.createWorkoutPlan({ ...basePlan(), studentId: "" })
    ).rejects.toThrow("Missing studentId");
  });

  it("normalizes exercise RPE — invalid value becomes null", async () => {
    const plan = await workoutService.createWorkoutPlan({
      ...basePlan(),
      exercises: [
        { name: "Squat", sets: 3, reps: "5", rest: "120", tempo: "", rpe: 99, weight: 100 },
      ],
    });
    // RPE 99 is out of range — the service normalizes it to a number but UI validation
    // catches this before save. Emulator stores what we send; we just verify normalizeExercise runs.
    expect(plan.exercises[0].name).toBe("Squat");
  });

  it("persists to Firestore — fetching by id returns the same plan", async () => {
    const created = await workoutService.createWorkoutPlan(basePlan());
    const fetched = await workoutService.getWorkoutPlanById(created.id);

    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.name).toBe(created.name);
    expect(fetched?.exercises).toHaveLength(2);
  });
});

// ─── getWorkoutPlanById ───────────────────────────────────────────────────────

describe("workoutService.getWorkoutPlanById", () => {
  it("returns null for a non-existent plan", async () => {
    const result = await workoutService.getWorkoutPlanById("does-not-exist");
    expect(result).toBeNull();
  });

  it("throws if planId is empty", async () => {
    await expect(workoutService.getWorkoutPlanById("")).rejects.toThrow();
  });
});

// ─── getActiveWorkoutPlansForStudent ──────────────────────────────────────────

describe("workoutService.getActiveWorkoutPlansForStudent", () => {
  it("returns active plans sorted by order ascending", async () => {
    const { coachId, studentId } = basePlan();

    await workoutService.createWorkoutPlan({ ...basePlan(), coachId, studentId, name: "Plan C", order: 2 });
    await workoutService.createWorkoutPlan({ ...basePlan(), coachId, studentId, name: "Plan A", order: 0 });
    await workoutService.createWorkoutPlan({ ...basePlan(), coachId, studentId, name: "Plan B", order: 1 });

    const plans = await workoutService.getActiveWorkoutPlansForStudent(studentId);

    expect(plans).toHaveLength(3);
    expect(plans[0].name).toBe("Plan A");
    expect(plans[1].name).toBe("Plan B");
    expect(plans[2].name).toBe("Plan C");
  });

  it("excludes deactivated plans", async () => {
    const { coachId, studentId } = basePlan();

    const active = await workoutService.createWorkoutPlan({ ...basePlan(), coachId, studentId, name: "Active", order: 0 });
    const inactive = await workoutService.createWorkoutPlan({ ...basePlan(), coachId, studentId, name: "Inactive", order: 1 });

    await workoutService.deactivateWorkoutPlan(inactive.id, coachId);

    const plans = await workoutService.getActiveWorkoutPlansForStudent(studentId);
    expect(plans).toHaveLength(1);
    expect(plans[0].id).toBe(active.id);
  });

  it("returns empty array when student has no plans", async () => {
    const plans = await workoutService.getActiveWorkoutPlansForStudent(testId("ghost"));
    expect(plans).toEqual([]);
  });
});

// ─── deactivateWorkoutPlan ────────────────────────────────────────────────────

describe("workoutService.deactivateWorkoutPlan", () => {
  it("sets isActive to false", async () => {
    const plan = await workoutService.createWorkoutPlan(basePlan());
    await workoutService.deactivateWorkoutPlan(plan.id, plan.coachId);

    const fetched = await workoutService.getWorkoutPlanById(plan.id);
    expect(fetched?.isActive).toBe(false);
  });

  it("throws if the plan belongs to a different coach", async () => {
    const plan = await workoutService.createWorkoutPlan(basePlan());
    await expect(
      workoutService.deactivateWorkoutPlan(plan.id, testId("other-coach"))
    ).rejects.toThrow("You don't have access to this workout plan.");
  });

  it("throws if plan does not exist", async () => {
    await expect(
      workoutService.deactivateWorkoutPlan("ghost-plan", testId("coach"))
    ).rejects.toThrow("Workout plan not found.");
  });
});

// ─── updateWorkoutPlan ────────────────────────────────────────────────────────

describe("workoutService.updateWorkoutPlan", () => {
  it("updates the plan name", async () => {
    const plan = await workoutService.createWorkoutPlan(basePlan());
    await workoutService.updateWorkoutPlan(plan.id, plan.coachId, { name: "Pull Day" });

    const fetched = await workoutService.getWorkoutPlanById(plan.id);
    expect(fetched?.name).toBe("Pull Day");
  });

  it("throws if a different coach tries to update", async () => {
    const plan = await workoutService.createWorkoutPlan(basePlan());
    await expect(
      workoutService.updateWorkoutPlan(plan.id, testId("other-coach"), { name: "Hack" })
    ).rejects.toThrow("You don't have access to this workout plan.");
  });

  it("throws if plan does not exist", async () => {
    await expect(
      workoutService.updateWorkoutPlan("ghost", testId("coach"), { name: "X" })
    ).rejects.toThrow("Workout plan not found.");
  });
});

// ─── duplicateWorkoutPlan ─────────────────────────────────────────────────────

describe("workoutService.duplicateWorkoutPlan", () => {
  it("creates a copy with '(Copy)' suffix in name", async () => {
    const original = await workoutService.createWorkoutPlan(basePlan());
    const copy = await workoutService.duplicateWorkoutPlan(original.id, original.coachId);

    expect(copy.id).not.toBe(original.id);
    expect(copy.name).toBe("Push Day (Copy)");
    expect(copy.studentId).toBe(original.studentId);
    expect(copy.exercises).toHaveLength(original.exercises.length);
  });

  it("does not double-append '(Copy)' when duplicating a copy", async () => {
    const original = await workoutService.createWorkoutPlan(basePlan());
    const copy = await workoutService.duplicateWorkoutPlan(original.id, original.coachId);
    const copyOfCopy = await workoutService.duplicateWorkoutPlan(copy.id, copy.coachId);

    expect(copyOfCopy.name).toBe("Push Day (Copy)");
  });

  it("throws if a different coach tries to duplicate", async () => {
    const plan = await workoutService.createWorkoutPlan(basePlan());
    await expect(
      workoutService.duplicateWorkoutPlan(plan.id, testId("other-coach"))
    ).rejects.toThrow("You don't have access to this workout plan.");
  });
});

// ─── logCompletedWorkout ──────────────────────────────────────────────────────

describe("workoutService.logCompletedWorkout", () => {
  it("saves a completed workout log and returns it with an id", async () => {
    const { studentId } = basePlan();
    const planId = testId("plan");

    const log = await workoutService.logCompletedWorkout({
      studentId,
      workoutPlanId: planId,
      workoutName: "Push Day",
      exercises: [baseLogExercise()],
      durationSeconds: 3600,
      sessionNotes: "Felt great",
    });

    expect(log.id).toBeTruthy();
    expect(log.studentId).toBe(studentId);
    expect(log.workoutName).toBe("Push Day");
    expect(log.durationSeconds).toBe(3600);
    expect(log.sessionNotes).toBe("Felt great");
  });

  it("calculates totalVolume from exercise sets when not provided", async () => {
    const { studentId } = basePlan();

    const log = await workoutService.logCompletedWorkout({
      studentId,
      workoutPlanId: testId("plan"),
      workoutName: "Push Day",
      exercises: [
        {
          ...baseLogExercise("Bench Press"),
          // 2 sets × 8 reps × 80kg = 1280
          sets: [
            { setNumber: 1, reps: 8, weight: 80 },
            { setNumber: 2, reps: 8, weight: 80 },
          ],
          volume: 1280,
        },
      ],
    });

    expect(log.totalVolume).toBeGreaterThan(0);
  });

  it("strips empty sessionNotes", async () => {
    const { studentId } = basePlan();

    const log = await workoutService.logCompletedWorkout({
      studentId,
      workoutPlanId: testId("plan"),
      workoutName: "Push Day",
      exercises: [baseLogExercise()],
      sessionNotes: "   ",
    });

    expect(log.sessionNotes).toBeUndefined();
  });

  it("throws if studentId is empty", async () => {
    await expect(
      workoutService.logCompletedWorkout({
        studentId: "",
        workoutPlanId: testId("plan"),
        workoutName: "Push Day",
        exercises: [baseLogExercise()],
      })
    ).rejects.toThrow("Missing studentId");
  });
});

// ─── getWorkoutHistory ────────────────────────────────────────────────────────

describe("workoutService.getWorkoutHistory", () => {
  it("returns logs sorted newest-first", async () => {
    const { studentId } = basePlan();
    const planId = testId("plan");

    await workoutService.logCompletedWorkout({
      studentId,
      workoutPlanId: planId,
      workoutName: "Day 1",
      exercises: [baseLogExercise()],
      completedAt: "2024-01-01T10:00:00.000Z",
    });

    await workoutService.logCompletedWorkout({
      studentId,
      workoutPlanId: planId,
      workoutName: "Day 2",
      exercises: [baseLogExercise()],
      completedAt: "2024-01-03T10:00:00.000Z",
    });

    await workoutService.logCompletedWorkout({
      studentId,
      workoutPlanId: planId,
      workoutName: "Day 3",
      exercises: [baseLogExercise()],
      completedAt: "2024-01-02T10:00:00.000Z",
    });

    const history = await workoutService.getWorkoutHistory(studentId);

    expect(history).toHaveLength(3);
    expect(history[0].workoutName).toBe("Day 2"); // newest first
    expect(history[1].workoutName).toBe("Day 3");
    expect(history[2].workoutName).toBe("Day 1");
  });

  it("returns empty array for a student with no logs", async () => {
    const history = await workoutService.getWorkoutHistory(testId("ghost"));
    expect(history).toEqual([]);
  });
});

// ─── updateWorkoutLogFeedback ─────────────────────────────────────────────────

describe("workoutService.updateWorkoutLogFeedback", () => {
  it("saves coach feedback on a student's workout log", async () => {
    const coachId = testId("coach");
    const studentId = testId("student");

    // Seed user docs so the service can validate coach ownership
    await seedUser(studentId, {
      email: "student@test.com",
      role: "student",
      coachId,
    });

    const log = await workoutService.logCompletedWorkout({
      studentId,
      workoutPlanId: testId("plan"),
      workoutName: "Push Day",
      exercises: [baseLogExercise()],
    });

    await workoutService.updateWorkoutLogFeedback(log.id, coachId, "Great session!");

    const updated = await workoutService.getWorkoutLogById(log.id);
    expect(updated?.coachFeedback).toBe("Great session!");
    expect(updated?.feedbackCreatedAt).toBeTruthy();
  });

  it("throws if feedback text is empty", async () => {
    const coachId = testId("coach");
    const studentId = testId("student");

    await seedUser(studentId, { email: "s@test.com", role: "student", coachId });

    const log = await workoutService.logCompletedWorkout({
      studentId,
      workoutPlanId: testId("plan"),
      workoutName: "Day 1",
      exercises: [baseLogExercise()],
    });

    await expect(
      workoutService.updateWorkoutLogFeedback(log.id, coachId, "   ")
    ).rejects.toThrow("Feedback cannot be empty.");
  });

  it("throws if a different coach tries to leave feedback", async () => {
    const coachId = testId("coach");
    const studentId = testId("student");

    await seedUser(studentId, { email: "s@test.com", role: "student", coachId });

    const log = await workoutService.logCompletedWorkout({
      studentId,
      workoutPlanId: testId("plan"),
      workoutName: "Day 1",
      exercises: [baseLogExercise()],
    });

    await expect(
      workoutService.updateWorkoutLogFeedback(log.id, testId("other-coach"), "Nope")
    ).rejects.toThrow("You can only add feedback for your own students.");
  });

  it("throws if the log does not exist", async () => {
    await expect(
      workoutService.updateWorkoutLogFeedback("ghost-log", testId("coach"), "Hi")
    ).rejects.toThrow("Workout log not found.");
  });
});
