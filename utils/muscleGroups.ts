export type MuscleGroup =
  | "chest"
  | "back"
  | "legs"
  | "shoulders"
  | "arms"
  | "core"
  | "cardio";

export interface MuscleGroupChip {
  key: MuscleGroup;
  label: string;
}

export const MUSCLE_GROUP_ORDER: readonly MuscleGroupChip[] = [
  { key: "chest", label: "Chest" },
  { key: "back", label: "Back" },
  { key: "legs", label: "Legs" },
  { key: "shoulders", label: "Shoulders" },
  { key: "arms", label: "Arms" },
  { key: "core", label: "Core" },
  { key: "cardio", label: "Cardio" },
] as const;

/**
 * Keyword → muscle group mapping. Patterns are tested against
 * `exerciseName.toLowerCase()`. An exercise can map to multiple groups
 * (e.g. "Deadlift" → back + legs).
 *
 * Edit cautiously: this drives the volume-by-muscle-group view.
 */
const PATTERNS: ReadonlyArray<{ groups: MuscleGroup[]; pattern: RegExp }> = [
  { groups: ["chest"], pattern: /bench|chest|pec|push\s*up|fly|flye|dip(?!\s*shrug)/ },
  { groups: ["back"], pattern: /row|pull\s*up|chin\s*up|pull\s*down|lat|deadlift|hyper|rdl/ },
  { groups: ["legs"], pattern: /squat|leg|lunge|deadlift|rdl|calf|glute|hip\s*thrust|leg\s*press|leg\s*curl|leg\s*extension/ },
  { groups: ["shoulders"], pattern: /shoulder|press(?!.*bench|.*leg)|delt|overhead|ohp|lateral|raise|shrug|upright\s*row/ },
  { groups: ["arms"], pattern: /curl|tricep|biceps?|extension|skullcrusher|hammer|preacher/ },
  { groups: ["core"], pattern: /ab\b|abs\b|plank|crunch|sit\s*up|leg\s*raise|hollow|rollout|wood\s*chop|russian/ },
  { groups: ["cardio"], pattern: /run|sprint|bike|cycl|row(?!.*bar)|elliptic|treadmill|hiit|cardio|jump\s*rope/ },
];

/**
 * Classify an exercise into one or more muscle groups. Returns an empty
 * array when no pattern matches (caller can bucket as "other").
 */
export function getMuscleGroups(exerciseName: string | null | undefined): MuscleGroup[] {
  if (!exerciseName) return [];
  const n = exerciseName.toLowerCase();
  const hit: MuscleGroup[] = [];
  for (const { groups, pattern } of PATTERNS) {
    if (pattern.test(n)) {
      for (const g of groups) if (!hit.includes(g)) hit.push(g);
    }
  }
  return hit;
}
