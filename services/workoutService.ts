import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  limit as limitFn,
  query,
  where,
  orderBy,
  updateDoc,
  writeBatch,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import type { Exercise, LoggedSet, WorkoutLog, WorkoutLogExercise, WorkoutPlan, WorkoutPlanChange } from "../types/Workout";
import {
  computeExerciseVolumeFromLoggedSets,
  computeTotalVolume,
  isPerSetLogArray,
  legacyExerciseToLoggedSets,
  parseRepsNumericForVolume,
} from "../utils/workoutMetrics";

const WORKOUT_PLANS_COLLECTION = "workoutPlans";
const WORKOUT_LOGS_COLLECTION = "workoutLogs";
const USERS_COLLECTION = "users";

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

import { logger } from "../utils/logger";
import { toMs } from "../utils/dateConvert";
import type {
  WorkoutPlanFirestoreDoc,
  WorkoutLogFirestoreDoc,
  UserFirestoreDoc,
  WorkoutPlanChangeFirestoreDoc,
} from "../types/firestore";

const WORKOUT_PLAN_CHANGES_COLLECTION = "workoutPlanChanges";

const assertNonEmpty = (value: string, label: string) => {
  if (!value || !value.trim()) throw new Error(`Missing ${label}.`);
  if (value.includes("@")) {
    console.warn(`[workoutService] Possible email used as ${label}:`, value);
  }
};

/** Stable id for an exercise row (reorder/diff identity) or a draft list key. */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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
    // Legacy exercises saved before this field existed get one assigned here;
    // it's only persisted once the plan is next saved through the editor.
    id: ex?.id != null && String(ex.id).trim() !== "" ? String(ex.id) : generateId(),
    name: ex?.name != null ? String(ex.name) : "",
    sets,
    reps,
    weight,
    rest,
    tempo,
    rpe,
    coachNote: ex?.coachNote != null && String(ex.coachNote).trim() !== "" ? String(ex.coachNote) : undefined,
    videoUrl: ex?.videoUrl != null && String(ex.videoUrl).trim() !== "" ? String(ex.videoUrl) : undefined,
    exerciseDbId: ex?.exerciseDbId != null && String(ex.exerciseDbId).trim() !== "" ? String(ex.exerciseDbId) : undefined,
  };
};

const mapChangeDoc = (snap: QueryDocumentSnapshot): WorkoutPlanChange => {
  const data = (snap.data() as WorkoutPlanChangeFirestoreDoc | undefined) ?? {};
  return {
    id: snap.id,
    planId: data.planId ?? "",
    studentId: data.studentId ?? "",
    coachId: data.coachId ?? "",
    type: data.type === "deleted" ? "deleted" : "updated",
    changedAt: data.changedAt,
    planNameSnapshot: data.planNameSnapshot ?? "Workout",
    coachMessage: data.coachMessage?.trim() || undefined,
    diff: data.diff as WorkoutPlanChange["diff"],
    planSnapshot: data.planSnapshot
      ? {
          name: data.planSnapshot.name ?? "Workout",
          exercises: Array.isArray(data.planSnapshot.exercises)
            ? data.planSnapshot.exercises.map(normalizeExercise)
            : [],
        }
      : undefined,
    // Missing field is treated as unread — every change doc is written with this `false`.
    studentNotificationRead: data.studentNotificationRead !== false,
  };
};

const normalizePlanData = (id: string, data: any): WorkoutPlan => ({
  id,
  ...data,
  // Keep group fields optional (legacy plans may not have them).
  groupId: data?.groupId != null ? String(data.groupId) : undefined,
  groupName: data?.groupName != null ? String(data.groupName) : undefined,
  // Missing field (legacy plans) is treated as read.
  studentNotificationRead: data?.studentNotificationRead !== false,
  estimatedDurationMinutes:
    data?.estimatedDurationMinutes == null || data.estimatedDurationMinutes === ""
      ? undefined
      : Number.isFinite(Number(data.estimatedDurationMinutes))
        ? Math.max(0, Math.floor(Number(data.estimatedDurationMinutes)))
        : undefined,
  // Normalize exercise fields to match our UI + Firestore contract.
  exercises: Array.isArray(data?.exercises) ? data.exercises.map(normalizeExercise) : [],
});

const mapPlanDoc = (snap: QueryDocumentSnapshot): WorkoutPlan => {
  const data = snap.data() as WorkoutPlanFirestoreDoc | undefined;
  if (!data) return normalizePlanData(snap.id, {});
  return normalizePlanData(snap.id, data);
};

/** Normalize one exercise row from Firestore (new per-set schema or legacy). */
export function normalizeLoggedExercise(ex: any): WorkoutLogExercise {
  const repsPlanned =
    ex?.repsPlanned != null ? String(ex.repsPlanned) : ex?.reps != null ? String(ex.reps) : "";
  const rpe =
    ex?.rpe == null || ex?.rpe === "" ? null : Number.isFinite(Number(ex.rpe)) ? Number(ex.rpe) : null;

  let setList: LoggedSet[];
  if (isPerSetLogArray(ex?.sets)) {
    setList = (ex.sets as any[]).map((s: any, i: number) => ({
      setNumber: Number.isFinite(Number(s?.setNumber)) ? Number(s.setNumber) : i + 1,
      reps: Number.isFinite(Number(s?.reps)) ? Math.max(0, Math.round(Number(s.reps))) : 0,
      weight:
        s?.weight == null || s?.weight === ""
          ? null
          : Number.isFinite(Number(s.weight))
            ? Number(s.weight)
            : null,
    }));
    setList = setList.map((s, i) => ({ ...s, setNumber: i + 1 }));
  } else {
    setList = legacyExerciseToLoggedSets(ex);
  }

  const volumeRaw = ex?.volume;
  const volume =
    volumeRaw != null && volumeRaw !== "" && Number.isFinite(Number(volumeRaw))
      ? Number(volumeRaw)
      : computeExerciseVolumeFromLoggedSets(setList);

  const validFlagReasons = ["different_gym", "different_machine", "miscalibrated", "other"];
  const equipmentFlagReason =
    typeof ex?.equipmentFlagReason === "string" && validFlagReasons.includes(ex.equipmentFlagReason)
      ? (ex.equipmentFlagReason as WorkoutLogExercise["equipmentFlagReason"])
      : undefined;

  return {
    name: ex?.name != null ? String(ex.name) : ex?.exercise != null ? String(ex.exercise) : "Exercise",
    repsPlanned,
    sets: setList,
    rest: ex?.rest != null ? String(ex.rest) : "",
    tempo: ex?.tempo != null ? String(ex.tempo) : "",
    rpe,
    volume,
    isPr: ex?.isPr === true,
    isSubstituted: ex?.isSubstituted === true,
    originalExerciseName:
      ex?.originalExerciseName != null && String(ex.originalExerciseName).trim() !== ""
        ? String(ex.originalExerciseName)
        : undefined,
    originalExerciseDbId:
      ex?.originalExerciseDbId != null && String(ex.originalExerciseDbId).trim() !== ""
        ? String(ex.originalExerciseDbId)
        : undefined,
    equipmentFlagged: ex?.equipmentFlagged === true,
    equipmentFlagReason,
    equipmentFlagNote:
      ex?.equipmentFlagNote != null && String(ex.equipmentFlagNote).trim() !== ""
        ? String(ex.equipmentFlagNote).slice(0, 100)
        : undefined,
  };
}

const mapLogDoc = (snap: QueryDocumentSnapshot): WorkoutLog => {
  const raw = snap.data() as WorkoutLogFirestoreDoc | undefined;
  const data: WorkoutLogFirestoreDoc = raw ?? {};
  const exercises: WorkoutLogExercise[] = Array.isArray(data.exercises)
    ? data.exercises.map(normalizeLoggedExercise)
    : [
        normalizeLoggedExercise({
          name: data.exercise,
          sets: data.sets as any,
          repsPlanned: data.reps,
          repsDone: data.reps,
          weight: data.weight,
        }),
      ];

  const totalVol = data.totalVolume;
  return {
    id: snap.id,
    studentId: data.studentId ?? "",
    workoutPlanId: data.workoutPlanId ?? "",
    workoutName: data.workoutName != null ? String(data.workoutName) : "Workout",
    exercises,
    completedAt: data.completedAt ?? data.date,
    sessionNotes:
      data.sessionNotes != null && String(data.sessionNotes).trim() !== ""
        ? String(data.sessionNotes)
        : undefined,
    totalVolume:
      totalVol != null && Number.isFinite(Number(totalVol))
        ? Number(totalVol)
        : undefined,
    coachFeedback:
      data.coachFeedback != null && String(data.coachFeedback).trim() !== ""
        ? String(data.coachFeedback)
        : undefined,
    feedbackCreatedAt:
      data.feedbackCreatedAt != null ? String(data.feedbackCreatedAt) : undefined,
    coachFeedbackPending: data.coachFeedbackPending === true,
    // Missing field (older logs, or logs without a coach) is treated as read.
    notificationRead: data.notificationRead !== false,
    durationSeconds:
      data.durationSeconds != null && Number.isFinite(Number(data.durationSeconds))
        ? Math.max(0, Math.floor(Number(data.durationSeconds)))
        : undefined,
    // Keep legacy fields available for older consumers while migrating.
    exercise: data.exercise,
    sets: typeof data.sets === "number" ? data.sets : undefined,
    reps: data.reps != null ? String(data.reps) : undefined,
    weight: typeof data.weight === "number" ? data.weight : undefined,
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
      // A freshly-assigned plan is always unread for the student, regardless
      // of what the caller passed (coach action just created it).
      studentNotificationRead: false,
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
    const data = snap.data() as WorkoutPlanFirestoreDoc | undefined;
    return normalizePlanData(snap.id, data ?? {});
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
   * Validates coach ownership before updating. `coachMessage` (if given) is
   * picked up by the server-side change trigger and attached to the
   * student's "workout removed" notification.
   */
  async deactivateWorkoutPlan(planId: string, coachId: string, coachMessage?: string): Promise<void> {
    assertNonEmpty(planId, "workoutPlanId");
    assertNonEmpty(coachId, "coachId (Firebase Auth UID)");

    const existing = await this.getWorkoutPlanById(planId);
    if (!existing) throw new Error("Workout plan not found.");
    if (existing.coachId !== coachId) throw new Error("You don't have access to this workout plan.");

    const ref = doc(db, WORKOUT_PLANS_COLLECTION, planId);
    await updateDoc(
      ref,
      sanitizeForFirestore({
        isActive: false,
        updatedAt: new Date(),
        // Always write an explicit value (never `undefined`, which `sanitizeForFirestore`
        // would drop from the patch entirely) — otherwise a message left by a previous
        // edit would silently survive into a later edit that didn't set one, and the
        // change-diff Cloud Function would misattribute it.
        lastCoachMessage: coachMessage?.trim() ?? "",
      }) as any
    );
  },

  /** Clone a plan for the same student with a new id and fresh timestamps. */
  async duplicateWorkoutPlan(planId: string, coachId: string): Promise<WorkoutPlan> {
    assertNonEmpty(planId, "workoutPlanId");
    assertNonEmpty(coachId, "coachId (Firebase Auth UID)");

    const existing = await this.getWorkoutPlanById(planId);
    if (!existing) throw new Error("Workout plan not found.");
    if (existing.coachId !== coachId) throw new Error("You don't have access to this workout plan.");

    const siblings = await this.getWorkoutPlansForStudentAsCoach(coachId, existing.studentId);
    const maxOrder = siblings.reduce((max, p) => {
      const n = typeof p.order === "number" && Number.isFinite(p.order) ? p.order : -1;
      return Math.max(max, n);
    }, -1);

    const copyName = `${(existing.name ?? "Workout Plan").replace(/\s*\(Copy(?: \d+)?\)\s*$/i, "").trim()} (Copy)`;
    const exercisesClone: Exercise[] = (existing.exercises ?? []).map((e) => ({ ...e }));

    return this.createWorkoutPlan({
      coachId: existing.coachId,
      studentId: existing.studentId,
      name: copyName,
      exercises: exercisesClone,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      order: maxOrder + 1,
      note: existing.note,
    });
  },

  /**
   * Updates an existing workout plan (coach-owned).
   * Does NOT change `isActive` or `order` unless explicitly provided.
   * `coachMessage` (if given) is picked up by the server-side change trigger
   * and attached to the student's "workout updated" notification — it is not
   * itself part of the plan's edit history.
   */
  async updateWorkoutPlan(
    planId: string,
    coachId: string,
    patch: Partial<Pick<WorkoutPlan, "name" | "exercises" | "note" | "order" | "isActive" | "estimatedDurationMinutes">>,
    coachMessage?: string
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
      lastCoachMessage: coachMessage?.trim() || undefined,
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
    const repsStr = String(payload.reps ?? "").trim();
    const repsOne = /^\d+$/.test(repsStr)
      ? Number(repsStr)
      : Math.max(1, Math.round(parseRepsNumericForVolume(repsStr) || 1));

    const entry: WorkoutLogExercise = normalizeLoggedExercise({
      name: payload.exercise,
      repsPlanned: String(payload.reps ?? ""),
      sets: [
        {
          setNumber: 1,
          reps: repsOne,
          weight: payload.weight ?? null,
        },
      ],
      rest: payload.rest ?? "",
      tempo: payload.tempo ?? "",
      rpe: payload.rpe ?? null,
    });

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

  async getWorkoutLogById(logId: string): Promise<WorkoutLog | null> {
    assertNonEmpty(logId, "workoutLogId");
    const ref = doc(db, WORKOUT_LOGS_COLLECTION, logId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return mapLogDoc(snap as unknown as QueryDocumentSnapshot);
  },

  /**
   * Coach leaves feedback on a student's completed workout (validates coach owns student).
   */
  async updateWorkoutLogFeedback(logId: string, coachId: string, feedback: string): Promise<void> {
    assertNonEmpty(logId, "workoutLogId");
    assertNonEmpty(coachId, "coachId (Firebase Auth UID)");
    const text = feedback.trim();
    if (!text) throw new Error("Feedback cannot be empty.");

    const logRef = doc(db, WORKOUT_LOGS_COLLECTION, logId);
    const logSnap = await getDoc(logRef);
    if (!logSnap.exists()) throw new Error("Workout log not found.");

    const logData = logSnap.data() as WorkoutLogFirestoreDoc | undefined;
    const studentId = logData?.studentId;
    if (!studentId || typeof studentId !== "string") {
      throw new Error("Invalid workout log.");
    }

    const userRef = doc(db, USERS_COLLECTION, studentId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error("Student not found.");
    const profile = userSnap.data() as UserFirestoreDoc | undefined;
    if (profile?.coachId !== coachId) {
      throw new Error("You can only add feedback for your own students.");
    }

    await updateDoc(
      logRef,
      sanitizeForFirestore({
        coachFeedback: text,
        feedbackCreatedAt: new Date().toISOString(),
        coachFeedbackPending: false,
      }) as any
    );
  },

  // Logs a full completed workout with all exercises (new schema).
  async logCompletedWorkout(payload: {
    studentId: string;
    workoutPlanId: string;
    workoutName: string;
    exercises: WorkoutLogExercise[];
    completedAt?: string;
    totalVolume?: number;
    durationSeconds?: number;
    sessionNotes?: string;
    coachId?: string;
  }): Promise<WorkoutLog> {
    assertNonEmpty(payload.studentId, "studentId (Firebase Auth UID)");
    assertNonEmpty(payload.workoutPlanId, "workoutPlanId");

    const completedAt = payload.completedAt ?? new Date().toISOString();
    const normalizedExercises = payload.exercises.map((ex) => {
      const base = normalizeLoggedExercise(ex);
      return {
        ...base,
        volume: ex.volume ?? base.volume,
        isPr: ex.isPr === true,
      };
    });
    const totalVolume =
      typeof payload.totalVolume === "number" && Number.isFinite(payload.totalVolume)
        ? payload.totalVolume
        : computeTotalVolume(normalizedExercises);

    const durationSeconds =
      typeof payload.durationSeconds === "number" && Number.isFinite(payload.durationSeconds)
        ? Math.max(0, Math.floor(payload.durationSeconds))
        : undefined;
    const sessionNotes =
      payload.sessionNotes != null && String(payload.sessionNotes).trim() !== ""
        ? String(payload.sessionNotes).trim()
        : undefined;

    const coachId =
      payload.coachId != null && payload.coachId.trim() !== ""
        ? payload.coachId.trim()
        : undefined;

    const dataToWrite = sanitizeForFirestore({
      studentId: payload.studentId,
      workoutPlanId: payload.workoutPlanId,
      workoutName: payload.workoutName?.trim() || "Workout",
      exercises: normalizedExercises,
      completedAt,
      totalVolume,
      sessionNotes,
      ...(durationSeconds !== undefined ? { durationSeconds } : {}),
      ...(coachId !== undefined ? { coachId } : {}),
      coachFeedbackPending: coachId ? true : false,
      ...(coachId ? { notificationRead: false } : {}),
    });

    const ref = await addDoc(collection(db, WORKOUT_LOGS_COLLECTION), dataToWrite);

    return {
      id: ref.id,
      studentId: payload.studentId,
      workoutPlanId: payload.workoutPlanId,
      workoutName: payload.workoutName?.trim() || "Workout",
      exercises: normalizedExercises,
      completedAt,
      totalVolume,
      ...(sessionNotes !== undefined ? { sessionNotes } : {}),
      ...(durationSeconds !== undefined ? { durationSeconds } : {}),
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

  async getLogsForCoachRecent(
    coachId: string,
    sinceMs: number,
    limit?: number,
  ): Promise<WorkoutLog[]> {
    assertNonEmpty(coachId, "coachId");
    const constraints: QueryConstraint[] = [
      where("coachId", "==", coachId),
      where("completedAt", ">", new Date(sinceMs)),
      orderBy("completedAt", "desc"),
    ];
    if (limit != null) constraints.push(limitFn(limit));
    return listWorkoutLogs(constraints);
  },

  async getLogsAwaitingFeedback(coachId: string, limit = 20): Promise<WorkoutLog[]> {
    assertNonEmpty(coachId, "coachId");
    return listWorkoutLogs([
      where("coachId", "==", coachId),
      where("coachFeedbackPending", "==", true),
      orderBy("completedAt", "desc"),
      limitFn(limit),
    ]);
  },

  /** Logs behind the coach's "student completed a workout" notification feed, most recent first. */
  async getNotificationLogsForCoach(coachId: string, limit = 100): Promise<WorkoutLog[]> {
    assertNonEmpty(coachId, "coachId");
    return listWorkoutLogs([
      where("coachId", "==", coachId),
      orderBy("completedAt", "desc"),
      limitFn(limit),
    ]);
  },

  /** Number of unread notifications for a coach — cheap count-only query for a badge. */
  async getUnreadNotificationCount(coachId: string): Promise<number> {
    assertNonEmpty(coachId, "coachId");
    const q = query(
      collection(db, WORKOUT_LOGS_COLLECTION),
      where("coachId", "==", coachId),
      where("notificationRead", "==", false)
    );
    const snap = await getCountFromServer(q);
    return snap.data().count;
  },

  async markNotificationRead(logId: string): Promise<void> {
    assertNonEmpty(logId, "workoutLogId");
    await updateDoc(doc(db, WORKOUT_LOGS_COLLECTION, logId), { notificationRead: true });
  },

  /** Marks every unread notification for this coach as read (the "Mark all read" action). */
  async markAllNotificationsRead(coachId: string): Promise<void> {
    assertNonEmpty(coachId, "coachId");
    const q = query(
      collection(db, WORKOUT_LOGS_COLLECTION),
      where("coachId", "==", coachId),
      where("notificationRead", "==", false)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    for (const d of snap.docs) {
      batch.update(d.ref, { notificationRead: true });
    }
    await batch.commit();
  },

  /** Plans behind the student's "coach assigned a new workout" notification feed, most recent first. */
  async getNotificationPlansForStudent(studentId: string, limit = 100): Promise<WorkoutPlan[]> {
    assertNonEmpty(studentId, "studentId");
    return listWorkoutPlans([
      where("studentId", "==", studentId),
      orderBy("createdAt", "desc"),
      limitFn(limit),
    ]);
  },

  /** Number of unread new-workout notifications for a student — cheap count-only query for a badge. */
  async getUnreadPlanNotificationCountForStudent(studentId: string): Promise<number> {
    assertNonEmpty(studentId, "studentId");
    const q = query(
      collection(db, WORKOUT_PLANS_COLLECTION),
      where("studentId", "==", studentId),
      where("studentNotificationRead", "==", false)
    );
    const snap = await getCountFromServer(q);
    return snap.data().count;
  },

  async markPlanNotificationRead(planId: string): Promise<void> {
    assertNonEmpty(planId, "workoutPlanId");
    await updateDoc(doc(db, WORKOUT_PLANS_COLLECTION, planId), { studentNotificationRead: true });
  },

  /** Marks every unread new-workout notification for this student as read (the "Mark all read" action). */
  async markAllPlanNotificationsReadForStudent(studentId: string): Promise<void> {
    assertNonEmpty(studentId, "studentId");
    const q = query(
      collection(db, WORKOUT_PLANS_COLLECTION),
      where("studentId", "==", studentId),
      where("studentNotificationRead", "==", false)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    for (const d of snap.docs) {
      batch.update(d.ref, { studentNotificationRead: true });
    }
    await batch.commit();
  },

  // Helper used by coach screens when building workout plans interactively.
  createEmptyExercise(): Exercise {
    return {
      id: generateId(),
      name: "",
      sets: 3,
      reps: "10",
      weight: 0,
      rest: "",
      tempo: "",
      rpe: null,
    };
  },

  /** One plan-edit or plan-removal record — feeds the student's "what changed" screen. */
  async getWorkoutPlanChangeById(changeId: string): Promise<WorkoutPlanChange | null> {
    assertNonEmpty(changeId, "changeId");
    const snap = await getDoc(doc(db, WORKOUT_PLAN_CHANGES_COLLECTION, changeId));
    if (!snap.exists()) return null;
    return mapChangeDoc(snap as unknown as QueryDocumentSnapshot);
  },

  /** Plan-edit/removal records behind the student's notification feed, most recent first. */
  async getWorkoutPlanChangesForStudent(studentId: string, limit = 100): Promise<WorkoutPlanChange[]> {
    assertNonEmpty(studentId, "studentId");
    const q = query(
      collection(db, WORKOUT_PLAN_CHANGES_COLLECTION),
      where("studentId", "==", studentId),
      orderBy("changedAt", "desc"),
      limitFn(limit)
    );
    const snap = await getDocs(q);
    return snap.docs.map(mapChangeDoc);
  },

  /** Number of unread plan-edit/removal notifications for a student — cheap count-only query for a badge. */
  async getUnreadChangeCountForStudent(studentId: string): Promise<number> {
    assertNonEmpty(studentId, "studentId");
    const q = query(
      collection(db, WORKOUT_PLAN_CHANGES_COLLECTION),
      where("studentId", "==", studentId),
      where("studentNotificationRead", "==", false)
    );
    const snap = await getCountFromServer(q);
    return snap.data().count;
  },

  async markChangeRead(changeId: string): Promise<void> {
    assertNonEmpty(changeId, "changeId");
    await updateDoc(doc(db, WORKOUT_PLAN_CHANGES_COLLECTION, changeId), { studentNotificationRead: true });
  },

  /** Marks every unread plan-edit/removal notification for this student as read (the "Mark all read" action). */
  async markAllChangesReadForStudent(studentId: string): Promise<void> {
    assertNonEmpty(studentId, "studentId");
    const q = query(
      collection(db, WORKOUT_PLAN_CHANGES_COLLECTION),
      where("studentId", "==", studentId),
      where("studentNotificationRead", "==", false)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    for (const d of snap.docs) {
      batch.update(d.ref, { studentNotificationRead: true });
    }
    await batch.commit();
  },
};

