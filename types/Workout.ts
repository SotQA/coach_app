export interface Exercise {
  name: string;
  sets: number;
  reps: number;
  weight?: number;
}

export interface WorkoutPlan {
  id: string;
  coachId: string;
  studentId: string;
  exercises: Exercise[];
}

export interface WorkoutLog {
  id: string;
  studentId: string;
  workoutPlanId?: string;
  exercise: string;
  sets: number;
  // Number of reps completed for this log entry.
  reps: number;
  weight?: number;
  // ISO date string so it is easy to sort and render
  date: string;
}

