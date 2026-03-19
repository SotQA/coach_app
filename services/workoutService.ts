import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import type { Exercise, WorkoutLog, WorkoutLogExercise, WorkoutPlan } from "../types/Workout";

const WORKOUT_PLANS_COLLECTION = "workoutPlans";
const WORKOUT_LOGS_COLLECTION = "workoutLogs";

/**
 * Firestore does not support `undefined` values inside document data.
 * This helper recursively removes keys with `undefined` values.
 */
function sanitizeForFirestore<T>(value: T): T {
  if (value === undefined) return value;
  if (value === null) return value;

  if (Array.isArray(value)) {
    const cleaned = value
      .map((v) => sanitizeForFirestore(v))
      // Remove any `undefined` array items after sanitizing.
      .filter((v) => v !== undefined);
    return cleaned as unknown as T;
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const sv = sanitizeForFirestore(v);
      if (sv !== undefined) cleaned[k] = sv;
    }
    return cleaned as unknown as T;
  }

  return value;
}

const assertNonEmpty = (value: string, label: string) => {
  if (!value || !value.trim()) throw new Error(`Missing ${label}.`);
  if (value.includes("@")) {
    console.warn(`[workoutService] Possible email used as ${label}:`, value);
  }
};

const toMs = (value: any): number => {
  if (!value) return 0;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : 0;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date ? d.getTime() : 0;
  }
  return 0;
};

const normalizeExercise = (ex: any): Exercise => {
  const reps = ex?.reps != null ? String(ex.reps) : "";
  const rest = ex?.rest != null ? String(ex.rest) : "";
  const tempo = ex?.tempo != null ? String(ex.tempo) : "";
  const rpeRaw = ex?.rpe;
  const rpe =
    rpeRaw == null || rpeRaw === "" ? null : Number.isFinite(Number(rpeRaw)) ? Number(rpeRaw) : null;

  const weight =
    ex?.weight == null || ex?.weight === "" ? undefined : Number.isFinite(Number(ex.weight)) ? Number(ex.weight) : undefined;

  const sets = Number.isFinite(Number(ex?.sets)) ? Number(ex.sets) : 0;

  return {
    name: ex?.name != null ? String(ex.name) : "",
    sets,
    reps,
    weight,
    rest,
    tempo,
    rpe,
  };
};

const normalizePlanData = (id: string, data: any): WorkoutPlan => ({
  id,
  ...data,
  // Normalize exercise fields to match our UI + Firestore contract.
  exercises: Array.isArray(data?.exercises) ? data.exercises.map(normalizeExercise) : [],
});

const mapPlanDoc = (snap: QueryDocumentSnapshot): WorkoutPlan => {
  const data = snap.data() as any;
  return normalizePlanData(snap.id, data);
};

const normalizeLoggedExercise = (ex: any): WorkoutLogExercise => {
  const sets = Number.isFinite(Number(ex?.sets)) ? Number(ex.sets) : 0;
  const repsPlanned = ex?.repsPlanned != null ? String(ex.repsPlanned) : ex?.reps != null ? String(ex.reps) : "";
  const repsDone =
    ex?.repsDone != null
      ? String(ex.repsDone)
      : ex?.reps != null
        ? String(ex.reps)
        : "";
  const weight =
    ex?.weight == null || ex?.weight === "" ? null : Number.isFinite(Number(ex.weight)) ? Number(ex.weight) : null;
  const rpe =
    ex?.rpe == null || ex?.rpe === "" ? null : Number.isFinite(Number(ex.rpe)) ? Number(ex.rpe) : null;

  return {
    name: ex?.name != null ? String(ex.name) : ex?.exercise != null ? String(ex.exercise) : "Exercise",
    sets,
    repsPlanned,
    repsDone,
    weight,
    rest: ex?.rest != null ? String(ex.rest) : "",
    tempo: ex?.tempo != null ? String(ex.tempo) : "",
    rpe,
  };
};

const mapLogDoc = (snap: QueryDocumentSnapshot): WorkoutLog => {
  const data = snap.data() as any;
  const exercises: WorkoutLogExercise[] = Array.isArray(data.exercises)
    ? data.exercises.map(normalizeLoggedExercise)
    : [
        normalizeLoggedExercise({
          name: data.exercise,
          sets: data.sets,
          repsPlanned: data.reps,
          repsDone: data.reps,
          weight: data.weight,
        }),
      ];

  return {
    id: snap.id,
    studentId: data.studentId,
    workoutPlanId: data.workoutPlanId,
    workoutName: data.workoutName != null ? String(data.workoutName) : "Workout",
    exercises,
    completedAt: data.completedAt ?? data.date,
    // Keep legacy fields available for older consumers while migrating.
    exercise: data.exercise,
    sets: data.sets,
    reps: data.reps != null ? String(data.reps) : undefined,
    weight: data.weight,
    date: data.date,
  };
};

async function listWorkoutPlans(constraints: QueryConstraint[]): Promise<WorkoutPlan[]> {
  const q = query(collection(db, WORKOUT_PLANS_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapPlanDoc);
}

async function listWorkoutLogs(constraints: QueryConstraint[]): Promise<WorkoutLog[]> {
  const q = query(collection(db, WORKOUT_LOGS_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapLogDoc);
}

export const workoutService = {
  // Creates a new workout plan for a specific student.
  async createWorkoutPlan(payload: Omit<WorkoutPlan, "id">): Promise<WorkoutPlan> {
    assertNonEmpty(payload.coachId, "coachId (Firebase Auth UID)");
    assertNonEmpty(payload.studentId, "studentId (Firebase Auth UID)");
    const normalized = {
      ...payload,
      name: payload.name?.trim() || "Workout Plan",
      createdAt: payload.createdAt ?? new Date(),
      updatedAt: payload.updatedAt ?? new Date(),
      isActive: payload.isActive ?? true,
      order: typeof payload.order === "number" && Number.isFinite(payload.order) ? payload.order : 0,
      scheduledDays: Array.isArray(payload.scheduledDays)
        ? payload.scheduledDays.filter((d) => typeof d === "string" && d.trim().length > 0)
        : undefined,
      note: payload.note?.trim() || undefined,
    };

    // Ensure no `undefined` fields are sent to Firestore.
    const firestoreData = sanitizeForFirestore(normalized);
    const ref = await addDoc(
      collection(db, WORKOUT_PLANS_COLLECTION),
      firestoreData
    );

    return {
      id: ref.id,
      ...normalized,
    };
  },

  // Retrieves the current workout plan for the student.
  // For simplicity, this returns the first plan found for the student.
  async getWorkoutPlanForStudent(studentId: string): Promise<WorkoutPlan | null> {
    const plans = await listWorkoutPlans([where("studentId", "==", studentId)]);
    return plans[0] ?? null;
  },

  async getWorkoutPlanById(planId: string): Promise<WorkoutPlan | null> {
    assertNonEmpty(planId, "workoutPlanId");
    const ref = doc(db, WORKOUT_PLANS_COLLECTION, planId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as any;
    return normalizePlanData(snap.id, data);
  },

  // Retrieves all workout plans for a student.
  async getWorkoutPlansForStudent(studentId: string): Promise<WorkoutPlan[]> {
    return listWorkoutPlans([where("studentId", "==", studentId)]);
  },

  /**
   * Retrieves active workout plans for a student ordered by `order`.
   * Falls back to legacy plans if the query returns none (older documents without `isActive`).
   */
  async getActiveWorkoutPlansForStudent(studentId: string): Promise<WorkoutPlan[]> {
    const activeQuery = () =>
      listWorkoutPlans([
        where("studentId", "==", studentId),
        where("isActive", "==", true),
        orderBy("order", "asc"),
      ]);

    try {
      const active = await activeQuery();
      if (active.length > 0) return active;
    } catch (e) {
      // If indexes/fields aren't ready yet, fall back to legacy query below.
      console.warn("[workoutService] Active plan query failed, falling back.", e);
    }

    const legacy = await listWorkoutPlans([where("studentId", "==", studentId)]);
    // Treat missing isActive as active and missing order as last.
    return legacy
      .filter((p) => p.isActive !== false)
      .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
  },

  // Coach-scoped: retrieves all workout plans that belong to a coach.
  async getWorkoutPlansForCoach(coachId: string): Promise<WorkoutPlan[]> {
    return listWorkoutPlans([where("coachId", "==", coachId)]);
  },

  // Coach-scoped: retrieves all workout plans for a student owned by the coach.
  async getWorkoutPlansForStudentAsCoach(
    coachId: string,
    studentId: string
  ): Promise<WorkoutPlan[]> {
    return listWorkoutPlans([
      where("coachId", "==", coachId),
      where("studentId", "==", studentId),
    ]);
  },

  /**
   * Soft delete a workout plan by setting `isActive=false`.
   * Validates coach ownership before updating.
   */
  async deactivateWorkoutPlan(planId: string, coachId: string): Promise<void> {
    assertNonEmpty(planId, "workoutPlanId");
    assertNonEmpty(coachId, "coachId (Firebase Auth UID)");

    const existing = await this.getWorkoutPlanById(planId);
    if (!existing) throw new Error("Workout plan not found.");
    if (existing.coachId !== coachId) throw new Error("You don't have access to this workout plan.");

    const ref = doc(db, WORKOUT_PLANS_COLLECTION, planId);
    await updateDoc(ref, {
      isActive: false,
      updatedAt: new Date(),
    });
  },

  /**
   * Updates an existing workout plan (coach-owned).
   * Does NOT change `isActive` or `order` unless explicitly provided.
   */
  async updateWorkoutPlan(
    planId: string,
    coachId: string,
    patch: Partial<Pick<WorkoutPlan, "name" | "exercises" | "note" | "order" | "isActive">>
  ): Promise<void> {
    assertNonEmpty(planId, "workoutPlanId");
    assertNonEmpty(coachId, "coachId (Firebase Auth UID)");

    const existing = await this.getWorkoutPlanById(planId);
    if (!existing) throw new Error("Workout plan not found.");
    if (existing.coachId !== coachId) throw new Error("You don't have access to this workout plan.");

    const ref = doc(db, WORKOUT_PLANS_COLLECTION, planId);
    const updateData = sanitizeForFirestore({
      ...patch,
      name: patch.name !== undefined ? patch.name.trim() : undefined,
      updatedAt: new Date(),
    } as any);
    await updateDoc(ref, updateData as any);
  },

  // Logs a single workout entry for backward compatibility.
  // Writes using the new schema (`workoutName`, `exercises[]`, `completedAt`).
  async logWorkoutEntry(
    payload: {
      studentId: string;
      workoutPlanId: string;
      workoutName?: string;
      exercise: string;
      sets: number;
      reps: string;
      weight?: number;
      rest?: string;
      tempo?: string;
      rpe?: number | null;
      completedAt?: string;
    }
  ): Promise<WorkoutLog> {
    assertNonEmpty(payload.studentId, "studentId (Firebase Auth UID)");
    assertNonEmpty(payload.workoutPlanId, "workoutPlanId");
    const completedAt = payload.completedAt ?? new Date().toISOString();
    const entry: WorkoutLogExercise = {
      name: payload.exercise,
      sets: payload.sets,
      repsPlanned: String(payload.reps ?? ""),
      repsDone: String(payload.reps ?? ""),
      weight: payload.weight ?? null,
      rest: payload.rest ?? "",
      tempo: payload.tempo ?? "",
      rpe: payload.rpe ?? null,
    };

    const dataToWrite = sanitizeForFirestore({
      studentId: payload.studentId,
      workoutPlanId: payload.workoutPlanId,
      workoutName: payload.workoutName ?? "Workout",
      exercises: [entry],
      completedAt,
    });

    const ref = await addDoc(collection(db, WORKOUT_LOGS_COLLECTION), dataToWrite);

    return {
      id: ref.id,
      studentId: payload.studentId,
      workoutPlanId: payload.workoutPlanId,
      workoutName: payload.workoutName ?? "Workout",
      exercises: [entry],
      completedAt,
    };
  },

  // Logs a full completed workout with all exercises (new schema).
  async logCompletedWorkout(payload: {
    studentId: string;
    workoutPlanId: string;
    workoutName: string;
    exercises: WorkoutLogExercise[];
    completedAt?: string;
  }): Promise<WorkoutLog> {
    assertNonEmpty(payload.studentId, "studentId (Firebase Auth UID)");
    assertNonEmpty(payload.workoutPlanId, "workoutPlanId");

    const completedAt = payload.completedAt ?? new Date().toISOString();
    const dataToWrite = sanitizeForFirestore({
      studentId: payload.studentId,
      workoutPlanId: payload.workoutPlanId,
      workoutName: payload.workoutName?.trim() || "Workout",
      exercises: payload.exercises.map(normalizeLoggedExercise),
      completedAt,
    });

    const ref = await addDoc(collection(db, WORKOUT_LOGS_COLLECTION), dataToWrite);

    return {
      id: ref.id,
      studentId: payload.studentId,
      workoutPlanId: payload.workoutPlanId,
      workoutName: payload.workoutName?.trim() || "Workout",
      exercises: payload.exercises.map(normalizeLoggedExercise),
      completedAt,
    };
  },

  // Returns all workout logs for a student, sorted newest-first by date.
  async getWorkoutHistory(studentId: string): Promise<WorkoutLog[]> {
    const logs = await listWorkoutLogs([where("studentId", "==", studentId)]);
    return logs.sort((a, b) => {
      const bMs = toMs((b as any).completedAt ?? (b as any).date);
      const aMs = toMs((a as any).completedAt ?? (a as any).date);
      return bMs - aMs;
    });
  },

  // Helper used by coach screens when building workout plans interactively.
  createEmptyExercise(): Exercise {
    return {
      name: "",
      sets: 3,
      reps: "10",
      weight: 0,
      rest: "",
      tempo: "",
      rpe: null,
    };
  },
};

