export interface Exercise {
  /**
   * Stable id for this exercise row, used to match exercises across an edit
   * (reordering, diffing old vs new). Legacy exercises may not have one yet —
   * backfilled the next time the plan is saved through the editor.
   */
  id?: string;
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
  videoUrl?: string;
  exerciseDbId?: string;
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
  /**
   * Whether the student has seen this plan in their notification feed.
   * Missing (legacy plans) is treated as read — only plans explicitly
   * written with this `false` should ever surface as unread.
   */
  studentNotificationRead?: boolean;
  /**
   * Most recent message a coach attached to an edit or removal — copied into
   * the corresponding `WorkoutPlanChange` doc by the server-side trigger.
   */
  lastCoachMessage?: string;
}

/** One field that differs between the previous and current version of a plan or exercise. */
export interface FieldDiff {
  from: string;
  to: string;
}

/** A single exercise involved in a plan edit — used for the added/removed lists. */
export interface ExerciseChangeSummary {
  id: string;
  name: string;
  sets?: number;
  reps?: string;
}

/** One exercise whose fields changed between the previous and current version of a plan. */
export interface ExerciseFieldChange {
  id: string;
  name: string;
  fields: Record<string, FieldDiff>;
}

/**
 * Immutable record of one coach edit or removal of a `WorkoutPlan`, written by a
 * Cloud Function off the Firestore before/after snapshot. Drives the student's
 * "what changed" / "what was removed" notification screen.
 */
export interface WorkoutPlanChange {
  id: string;
  planId: string;
  studentId: string;
  coachId: string;
  type: "updated" | "deleted";
  changedAt: any;
  /** Plan name at the time of the change (survives the plan itself being renamed/removed later). */
  planNameSnapshot: string;
  /** Optional note the coach attached when saving the edit or removing the plan. */
  coachMessage?: string;
  /** Present when `type === "updated"`. */
  diff?: {
    planFields?: Record<string, FieldDiff>;
    exercisesChanged?: ExerciseFieldChange[];
    exercisesAdded?: ExerciseChangeSummary[];
    exercisesRemoved?: ExerciseChangeSummary[];
  };
  /** Present when `type === "deleted"` — a full snapshot of what the plan contained. */
  planSnapshot?: {
    name: string;
    exercises: Exercise[];
  };
  /**
   * Whether the student has seen this change in their notification feed.
   * Missing is treated as unread (every change doc is written with this `false`).
   */
  studentNotificationRead?: boolean;
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
  /** True until the coach submits feedback; false after feedback is saved. */
  coachFeedbackPending?: boolean;
  /** Wall-clock workout length (execution screen → complete), seconds. */
  durationSeconds?: number;
  /**
   * Whether the coach has seen the "student completed a workout" notification for this log.
   * Missing (older logs, or logs without a coachId) is treated as read — only logs written
   * with this explicitly `false` should ever surface as unread.
   */
  notificationRead?: boolean;
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

export type EquipmentFlagReason = "different_gym" | "different_machine" | "miscalibrated" | "other";

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
  /** True when this was swapped in for the plan's exercise, for this session only. */
  isSubstituted?: boolean;
  /** Plan exercise name this replaced, when `isSubstituted` is true. */
  originalExerciseName?: string;
  /** Plan exercise's exerciseDbId, when `isSubstituted` is true and available. */
  originalExerciseDbId?: string;
  /** True when the student flagged this session's equipment as non-comparable. */
  equipmentFlagged?: boolean;
  equipmentFlagReason?: EquipmentFlagReason;
  /** Optional note, only meaningful when equipmentFlagReason === "other". Max 100 chars. */
  equipmentFlagNote?: string;
}

