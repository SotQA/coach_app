import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import type { Exercise, WorkoutLog, WorkoutPlan } from "../types/Workout";

const WORKOUT_PLANS_COLLECTION = "workoutPlans";
const WORKOUT_LOGS_COLLECTION = "workoutLogs";

export const workoutService = {
  // Creates a new workout plan for a specific student.
  async createWorkoutPlan(payload: Omit<WorkoutPlan, "id">): Promise<WorkoutPlan> {
    if (!payload.coachId) {
      throw new Error("Missing coachId (Firebase Auth UID).");
    }
    if (!payload.studentId) {
      throw new Error("Missing studentId (Firebase Auth UID).");
    }
    const ref = await addDoc(
      collection(db, WORKOUT_PLANS_COLLECTION),
      payload
    );

    return {
      id: ref.id,
      ...payload,
    };
  },

  // Retrieves the current workout plan for the student.
  // For simplicity, this returns the first plan found for the student.
  async getWorkoutPlanForStudent(studentId: string): Promise<WorkoutPlan | null> {
    const q = query(
      collection(db, WORKOUT_PLANS_COLLECTION),
      where("studentId", "==", studentId)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data() as Omit<WorkoutPlan, "id">;

    return {
      id: doc.id,
      ...data,
    };
  },

  // Retrieves all workout plans for a student.
  async getWorkoutPlansForStudent(studentId: string): Promise<WorkoutPlan[]> {
    const q = query(
      collection(db, WORKOUT_PLANS_COLLECTION),
      where("studentId", "==", studentId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data() as Omit<WorkoutPlan, "id">;
      return {
        id: doc.id,
        ...data,
      };
    });
  },

  // Logs a single workout entry for the student.
  async logWorkoutEntry(
    payload: Omit<WorkoutLog, "id" | "date"> & { date?: string }
  ): Promise<WorkoutLog> {
    const date = payload.date ?? new Date().toISOString();
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
    const q = query(
      collection(db, WORKOUT_LOGS_COLLECTION),
      where("studentId", "==", studentId)
    );
    const snapshot = await getDocs(q);

    const logs: WorkoutLog[] = snapshot.docs.map((doc) => {
      const data = doc.data() as Omit<WorkoutLog, "id">;
      return {
        id: doc.id,
        ...data,
      };
    });

    return logs.sort((a, b) => (a.date < b.date ? 1 : -1));
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

