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
  name: string;
  exercises: Exercise[];
  createdAt: any;
}

export interface WorkoutLog {
  id: string;
  studentId: string;
  workoutPlanId: string;
  exercise: string;
  sets: number;
  // Number of reps completed for this log entry.
  reps: number;
  weight?: number;
  date: any;
}

