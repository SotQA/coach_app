export interface Exercise {
  name: string;
  sets: number;
  // Stored in Firestore as string (Firestore previously stored as int64).
  reps: string;
  weight?: number;
  // Advanced training fields (stored on workout plans).
  rest: string;
  tempo: string;
  // Null means empty / not set.
  rpe: number | null;
  // Optional per-exercise coach note (stored on workout plans).
  coachNote?: string;
}

export interface WorkoutPlan {
  id: string;
  coachId: string;
  studentId: string;
  /**
   * Training group/split this plan belongs to (new system).
   * Missing on legacy plans.
   */
  groupId?: string;
  groupName?: string;
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
  // Optional estimated duration in minutes.
  estimatedDurationMinutes?: number;
}

export interface WorkoutLog {
  id: string;
  studentId: string;
  workoutPlanId: string;
  workoutName: string;
  exercises: WorkoutLogExercise[];
  completedAt: any;
  /** Optional student notes for the session. */
  sessionNotes?: string;
  /** Sum of per-exercise volume (sets × reps × weight) for this session. */
  totalVolume?: number;
  /** Coach feedback on a completed workout. */
  coachFeedback?: string;
  feedbackCreatedAt?: string;
  /** Wall-clock workout length (execution screen → complete), seconds. */
  durationSeconds?: number;
  // Legacy fields (for backward compatibility with older workout logs).
  exercise?: string;
  sets?: number;
  reps?: string;
  weight?: number;
  date?: any;
}

/** One logged work set (Firestore + app model). */
export interface LoggedSet {
  setNumber: number;
  reps: number;
  weight: number | null;
}

export interface WorkoutLogExercise {
  name: string;
  repsPlanned: string;
  /** Per-set log (canonical). Legacy docs are normalized into this shape when read. */
  sets: LoggedSet[];
  rest: string;
  tempo: string;
  rpe: number | null;
  /** Sum of reps×weight over logged sets. */
  volume?: number;
  /** True when max weight this session beats prior best for this exercise. */
  isPr?: boolean;
}

