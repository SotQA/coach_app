export type TrainingGroupType =
  | "Full Body"
  | "Upper / Lower"
  | "PPL"
  | "Strength Block"
  | "Hypertrophy"
  | "Deload"
  | "Conditioning"
  | "Custom";

export interface TrainingGroup {
  id: string;
  studentId: string;
  coachId: string;
  /**
   * Display name of the split/group (e.g., "PPL", "Upper / Lower", "Hypertrophy Block A").
   */
  name: string;
  type: TrainingGroupType | string;
  workoutsPerWeek: number;
  createdAt: any;
  updatedAt: any;
}

