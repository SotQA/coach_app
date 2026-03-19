export interface Exercise {
  name: string;
  sets: number;
  // Stored in Firestore as string (Firestore previously stored as int64).
  reps: string;
  weight?: number;
}

export interface WorkoutPlan {
  id: string;
  coachId: string;
  studentId: string;
  name: string;
  exercises: Exercise[];
  createdAt: any;
  /**
   * Ordering for workout plans in the student list.
   * Lower numbers appear first.
   */
  order?: number;
  /**
   * Whether the plan is currently active for the student.
   * Legacy plans may not have this field; treat missing as active in UI.
   */
  isActive?: boolean;
  /**
   * Last updated timestamp (Date, ISO string, or Firestore Timestamp-like).
   */
  updatedAt?: any;
  // Legacy field (deprecated): day-based scheduling.
  scheduledDays?: string[];
  // Optional note from the coach for this plan.
  note?: string;
}

export interface WorkoutLog {
  id: string;
  studentId: string;
  workoutPlanId: string;
  exercise: string;
  sets: number;
  // Stored in Firestore as string (Firestore previously stored as int64).
  reps: string;
  weight?: number;
  date: any;
}

