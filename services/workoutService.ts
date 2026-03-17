import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import type { Exercise, WorkoutLog, WorkoutPlan } from "../types/Workout";

const WORKOUT_PLANS_COLLECTION = "workoutPlans";
const WORKOUT_LOGS_COLLECTION = "workoutLogs";

const assertNonEmpty = (value: string, label: string) => {
  if (!value || !value.trim()) throw new Error(`Missing ${label}.`);
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

const mapPlanDoc = (snap: QueryDocumentSnapshot): WorkoutPlan => ({
  id: snap.id,
  ...(snap.data() as Omit<WorkoutPlan, "id">),
});

const mapLogDoc = (snap: QueryDocumentSnapshot): WorkoutLog => ({
  id: snap.id,
  ...(snap.data() as Omit<WorkoutLog, "id">),
});

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
    };
    const ref = await addDoc(
      collection(db, WORKOUT_PLANS_COLLECTION),
      normalized
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
    return {
      id: snap.id,
      ...(snap.data() as Omit<WorkoutPlan, "id">),
    };
  },

  // Retrieves all workout plans for a student.
  async getWorkoutPlansForStudent(studentId: string): Promise<WorkoutPlan[]> {
    return listWorkoutPlans([where("studentId", "==", studentId)]);
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

  // Logs a single workout entry for the student.
  async logWorkoutEntry(
    payload: Omit<WorkoutLog, "id" | "date"> & { date?: Date }
  ): Promise<WorkoutLog> {
    assertNonEmpty(payload.studentId, "studentId (Firebase Auth UID)");
    assertNonEmpty(payload.workoutPlanId, "workoutPlanId");
    const date = payload.date ?? new Date();
    const ref = await addDoc(collection(db, WORKOUT_LOGS_COLLECTION), {
      ...payload,
      date,
    });

    return {
      id: ref.id,
      ...payload,
      date,
    };
  },

  // Returns all workout logs for a student, sorted newest-first by date.
  async getWorkoutHistory(studentId: string): Promise<WorkoutLog[]> {
    const logs = await listWorkoutLogs([where("studentId", "==", studentId)]);
    return logs.sort((a, b) => toMs(b.date) - toMs(a.date));
  },

  // Helper used by coach screens when building workout plans interactively.
  createEmptyExercise(): Exercise {
    return {
      name: "",
      sets: 3,
      reps: 10,
      weight: 0,
    };
  },
};

