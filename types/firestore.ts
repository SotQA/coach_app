/**
 * On-the-wire document shapes read from Firestore.
 * These are ONLY used at the service boundary (snap.data() cast target).
 * All fields are optional — Firestore documents can be partial.
 * Downstream normalization functions convert these to domain types.
 */
import type { Timestamp } from "firebase/firestore";

export interface UserFirestoreDoc {
  role?: string;              // validated by asValidRole() in AuthContext
  firstName?: string;
  lastName?: string;
  email?: string;
  coachId?: string;
  dateOfBirth?: string;
  sex?: string;
  createdAt?: Timestamp | string;
  photoURL?: string;
}

export interface ExerciseFirestoreDoc {
  name?: string;
  sets?: number | string;
  reps?: string;
  weight?: number | string | null;
  rest?: string;
  tempo?: string;
  rpe?: number | string | null;
  coachNote?: string;
}

export interface WorkoutPlanFirestoreDoc {
  studentId?: string;
  coachId?: string;
  name?: string;
  exercises?: ExerciseFirestoreDoc[];
  groupId?: string;
  groupName?: string;
  order?: number;
  isActive?: boolean;
  estimatedDurationMinutes?: number | string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface WorkoutLogExerciseFirestoreDoc {
  name?: string;
  exercise?: string;       // legacy field alias for name
  repsPlanned?: string | number;
  reps?: string | number;  // legacy alias
  repsDone?: string | number;
  weight?: number | string | null;
  sets?: unknown;          // can be a per-set array or legacy number
  rest?: string;
  tempo?: string;
  rpe?: number | string | null;
  volume?: number | string;
  isPr?: boolean;
}

export interface WorkoutLogFirestoreDoc {
  studentId?: string;
  coachId?: string;
  workoutPlanId?: string;
  workoutName?: string;
  exercises?: WorkoutLogExerciseFirestoreDoc[];
  // Legacy single-exercise fields
  exercise?: string;
  reps?: string | number;
  weight?: number | string;
  totalVolume?: number;
  sets?: unknown;                  // legacy: top-level number of sets (old single-exercise schema)
  completedAt?: Timestamp | string;
  date?: Timestamp | string;       // legacy alias for completedAt
  sessionNotes?: string;
  durationSeconds?: number;
  coachFeedback?: string;
  feedbackCreatedAt?: string;
}

export interface TrainingGroupFirestoreDoc {
  studentId?: string;
  coachId?: string;
  name?: string;
  type?: string;
  workoutsPerWeek?: number | string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface ExerciseTemplateFirestoreDoc {
  name?: string;
  coachId?: string;
  category?: string;
  equipment?: string;
  usageCount?: number | string;
  createdAt?: Timestamp | string;
  lastUsedAt?: Timestamp | string;
  source?: "custom" | "exerciseDB";
  exerciseDbId?: string;
  gifUrl?: string;
  imageUrls?: { "360p": string; "480p": string; "720p": string; "1080p": string };
  videoUrl?: string;
  overview?: string;
  exerciseTips?: string[];
  targetMuscle?: string;
  secondaryMuscles?: string[];
  instructions?: string[];
}
