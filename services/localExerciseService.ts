import rawData from "../assets/exerciseData.json";

export type LocalExercise = {
  id: string;
  name: string;
  nameRu?: string;
  namePl?: string;
  equipment: string | null;
  category: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  level: string | null;
  force: string | null;
  mechanic: string | null;
};

const ALL_EXERCISES: LocalExercise[] = (rawData as any[])
  .sort((a, b) => a.name.localeCompare(b.name));

export function getExerciseName(
  exercise: LocalExercise,
  lang: "en" | "ru" | "pl"
): string {
  if (lang === "ru" && exercise.nameRu) return exercise.nameRu;
  if (lang === "pl" && exercise.namePl) return exercise.namePl;
  return exercise.name;
}

export function getExerciseById(id: string): LocalExercise | null {
  return ALL_EXERCISES.find(e => e.id === id) ?? null;
}

export type ExerciseFilter = {
  query?: string;
  equipment?: string | null;
  muscle?: string | null;
  lang?: "en" | "ru" | "pl";
};

export function filterExercises(filter: ExerciseFilter): LocalExercise[] {
  let results = ALL_EXERCISES;

  if (filter.muscle && filter.muscle !== "all") {
    results = results.filter(e =>
      e.primaryMuscles.some(m =>
        m.toLowerCase() === filter.muscle!.toLowerCase()
      )
    );
  }

  if (filter.equipment && filter.equipment !== "all") {
    results = results.filter(e =>
      e.equipment?.toLowerCase() === filter.equipment!.toLowerCase()
    );
  }

  if (filter.query && filter.query.trim().length >= 2) {
    const q = filter.query.trim().toLowerCase();
    const lang = filter.lang ?? "en";
    const startsWith = results.filter(e =>
      getExerciseName(e, lang).toLowerCase().startsWith(q)
    );
    const contains = results.filter(e =>
      !getExerciseName(e, lang).toLowerCase().startsWith(q) &&
      getExerciseName(e, lang).toLowerCase().includes(q)
    );
    results = [...startsWith, ...contains];
  }

  return results;
}

export function getAllEquipmentOptions(): string[] {
  const set = new Set(ALL_EXERCISES.map(e => e.equipment).filter(Boolean));
  return ["all", ...Array.from(set as Set<string>).sort()];
}

export function getAllMuscleOptions(): string[] {
  const set = new Set(ALL_EXERCISES.flatMap(e => e.primaryMuscles));
  return ["all", ...Array.from(set).sort()];
}
