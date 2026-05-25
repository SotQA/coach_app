import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

const EXERCISEDB_BASE =
  "https://edb-with-videos-and-images-by-ascendapi.p.rapidapi.com";

const RAPIDAPI_KEY = process.env.EXPO_PUBLIC_RAPIDAPI_KEY ?? "";
if (!RAPIDAPI_KEY) {
  console.error(
    "ExerciseDB API key not configured. Add EXPO_PUBLIC_RAPIDAPI_KEY to your .env file."
  );
}

export const RAPIDAPI_HEADERS: Record<string, string> = {
  "X-RapidAPI-Key": RAPIDAPI_KEY,
  "X-RapidAPI-Host": "edb-with-videos-and-images-by-ascendapi.p.rapidapi.com",
};

const GLOBAL_EXERCISES_COLLECTION = "globalExercises";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ExerciseDBExercise = {
  // Core identity (V2 native names)
  exerciseId: string;
  name: string;
  bodyParts: string[];        // UPPERCASE, e.g. ["CHEST"]
  equipments: string[];       // UPPERCASE, e.g. ["BARBELL"]
  targetMuscles: string[];    // UPPERCASE, e.g. ["PECTORALS"]
  secondaryMuscles: string[]; // UPPERCASE
  instructions: string[];
  overview: string;
  exerciseTips: string[];
  variations: string[];
  exerciseType: string;       // e.g. "STRENGTH"
  keywords: string[];
  relatedExerciseIds: string[];
  imageUrl: string;           // default image (360p webp)
  imageUrls: {
    "360p": string;
    "480p": string;
    "720p": string;
    "1080p": string;
  };
  videoUrl: string;

  // Backwards-compat aliases (mapped from V2 fields) — keep these so callers don't break
  id: string;           // = exerciseId
  bodyPart: string;     // = bodyParts[0] (lowercased for mapBodyPartToCategory compat)
  equipment: string;    // = equipments[0]
  gifUrl: string;       // = imageUrls["360p"]
  target: string;       // = targetMuscles[0]
};

export type CachedExercise = {
  id: string;
  name: string;
  category: string;
  equipment: string;
  gifUrl: string;          // keep for backwards compat (= imageUrls["360p"])
  imageUrl?: string;       // same as gifUrl but clearer name
  imageUrls?: { "360p": string; "480p": string; "720p": string; "1080p": string };
  videoUrl?: string;
  overview?: string;
  exerciseTips?: string[];
  targetMuscle: string;
  secondaryMuscles: string[];
  instructions?: string[];
  source: "exerciseDB";
};

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

export function mapBodyPartToCategory(bodyPart: string): string {
  switch (bodyPart.toLowerCase()) {
    case "chest": return "Chest";
    case "back": return "Back";
    case "upper legs":
    case "lower legs": return "Legs";
    case "shoulders": return "Shoulders";
    case "upper arms":
    case "lower arms": return "Arms";
    case "waist": return "Core";
    case "cardio": return "Cardio";
    default: return "Mobility";
  }
}

export function mapEquipment(equipment: string): string {
  switch (equipment.toLowerCase()) {
    case "barbell": return "Barbell";
    case "dumbbell": return "Dumbbell";
    case "cable": return "Cable";
    case "machine": return "Machine";
    case "body weight": return "Body Weight";
    case "kettlebell": return "Kettlebell";
    case "resistance band": return "Resistance Band";
    case "ez barbell": return "EZ Bar";
    case "trap bar": return "Trap Bar";
    case "smith machine": return "Smith Machine";
    case "leverage machine": return "Leverage Machine";
    case "olympic barbell": return "Olympic Barbell";
    case "assisted": return "Assisted";
    case "roller": return "Roller";
    case "band": return "Band";
    case "rope": return "Rope";
    case "sled machine": return "Sled Machine";
    case "weighted": return "Weighted";
    default: return equipment.charAt(0).toUpperCase() + equipment.slice(1).toLowerCase();
  }
}

// ---------------------------------------------------------------------------
// Internal builder: V2 raw response → ExerciseDBExercise
// ---------------------------------------------------------------------------

function buildExercise(raw: Record<string, unknown>): ExerciseDBExercise {
  const exerciseId = String(raw.exerciseId ?? raw.id ?? "");
  const bodyParts = Array.isArray(raw.bodyParts) ? (raw.bodyParts as string[]) : [];
  const equipments = Array.isArray(raw.equipments) ? (raw.equipments as string[]) : [];
  const targetMuscles = Array.isArray(raw.targetMuscles) ? (raw.targetMuscles as string[]) : [];
  const imageUrls = (raw.imageUrls as ExerciseDBExercise["imageUrls"]) ?? {
    "360p": String(raw.imageUrl ?? ""),
    "480p": String(raw.imageUrl ?? ""),
    "720p": String(raw.imageUrl ?? ""),
    "1080p": String(raw.imageUrl ?? ""),
  };
  const bodyPartRaw = bodyParts[0] ?? "";
  const equipmentRaw = equipments[0] ?? "";
  const targetRaw = targetMuscles[0] ?? "";
  return {
    exerciseId,
    name: String(raw.name ?? ""),
    bodyParts,
    equipments,
    targetMuscles,
    secondaryMuscles: Array.isArray(raw.secondaryMuscles) ? (raw.secondaryMuscles as string[]) : [],
    instructions: Array.isArray(raw.instructions) ? (raw.instructions as string[]) : [],
    overview: String(raw.overview ?? ""),
    exerciseTips: Array.isArray(raw.exerciseTips) ? (raw.exerciseTips as string[]) : [],
    variations: Array.isArray(raw.variations) ? (raw.variations as string[]) : [],
    exerciseType: String(
      raw.exerciseType ??
        (Array.isArray(raw.exerciseTypes) ? (raw.exerciseTypes as string[])[0] : "") ??
        ""
    ),
    keywords: Array.isArray(raw.keywords) ? (raw.keywords as string[]) : [],
    relatedExerciseIds: Array.isArray(raw.relatedExerciseIds)
      ? (raw.relatedExerciseIds as string[])
      : [],
    imageUrl: imageUrls["360p"],
    imageUrls,
    videoUrl: String(raw.videoUrl ?? ""),
    // Backwards-compat aliases
    id: exerciseId,
    bodyPart: bodyPartRaw.toLowerCase(),
    equipment: equipmentRaw.toLowerCase(),
    gifUrl: imageUrls["360p"],
    target: targetRaw.toLowerCase(),
  };
}

// ---------------------------------------------------------------------------
// Firestore cache
// ---------------------------------------------------------------------------

/** Write a raw ExerciseDB exercise to /globalExercises/{id} (merge). */
export async function cacheExerciseToFirestore(
  exercise: ExerciseDBExercise
): Promise<void> {
  try {
    const ref = doc(db, GLOBAL_EXERCISES_COLLECTION, exercise.id);
    await setDoc(
      ref,
      {
        name: exercise.name,
        category: mapBodyPartToCategory(exercise.bodyPart),
        equipment: mapEquipment(exercise.equipment),
        gifUrl: exercise.gifUrl,
        imageUrls: exercise.imageUrls,
        videoUrl: exercise.videoUrl,
        overview: exercise.overview,
        exerciseTips: exercise.exerciseTips,
        targetMuscle: exercise.target,
        secondaryMuscles: exercise.secondaryMuscles,
        instructions: exercise.instructions,
        source: "exerciseDB",
        cachedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn("[exerciseDbService] cacheExerciseToFirestore error", e);
  }
}

/** Write an already-mapped CachedExercise to /globalExercises/{id} (merge). */
export async function cacheMappedExerciseToFirestore(
  exercise: CachedExercise
): Promise<void> {
  try {
    const ref = doc(db, GLOBAL_EXERCISES_COLLECTION, exercise.id);
    await setDoc(
      ref,
      {
        name: exercise.name,
        category: exercise.category,
        equipment: exercise.equipment,
        gifUrl: exercise.gifUrl,
        imageUrls: exercise.imageUrls,
        videoUrl: exercise.videoUrl,
        overview: exercise.overview,
        exerciseTips: exercise.exerciseTips,
        targetMuscle: exercise.targetMuscle,
        secondaryMuscles: exercise.secondaryMuscles,
        instructions: exercise.instructions ?? [],
        source: "exerciseDB",
        cachedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn("[exerciseDbService] cacheMappedExerciseToFirestore error", e);
  }
}

/** Case-insensitive prefix search against /globalExercises (limit 10). */
export async function searchGlobalCache(
  queryStr: string
): Promise<CachedExercise[]> {
  try {
    const lowerQ = queryStr.trim().toLowerCase();
    if (!lowerQ) return [];
    const ref = collection(db, GLOBAL_EXERCISES_COLLECTION);
    const snap = await getDocs(query(ref, limit(200)));
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: String(data.name ?? ""),
          category: String(data.category ?? ""),
          equipment: String(data.equipment ?? ""),
          gifUrl: String(data.gifUrl ?? ""),
          imageUrls: data.imageUrls as CachedExercise["imageUrls"] | undefined,
          videoUrl: data.videoUrl ? String(data.videoUrl) : undefined,
          overview: data.overview ? String(data.overview) : undefined,
          exerciseTips: Array.isArray(data.exerciseTips)
            ? (data.exerciseTips as string[])
            : undefined,
          targetMuscle: String(data.targetMuscle ?? ""),
          secondaryMuscles: Array.isArray(data.secondaryMuscles)
            ? (data.secondaryMuscles as string[])
            : [],
          instructions: Array.isArray(data.instructions)
            ? (data.instructions as string[])
            : undefined,
          source: "exerciseDB" as const,
        };
      })
      .filter((e) => e.name.toLowerCase().startsWith(lowerQ))
      .slice(0, 10);
  } catch (e) {
    console.warn("[exerciseDbService] searchGlobalCache error", e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function cachedToDBExercise(c: CachedExercise): ExerciseDBExercise {
  const imageUrls: ExerciseDBExercise["imageUrls"] = c.imageUrls ?? {
    "360p": c.gifUrl,
    "480p": c.gifUrl,
    "720p": c.gifUrl,
    "1080p": c.gifUrl,
  };
  return {
    exerciseId: c.id,
    id: c.id,
    name: c.name,
    bodyParts: [c.category.toUpperCase()],
    equipments: [c.equipment.toUpperCase()],
    targetMuscles: [c.targetMuscle.toUpperCase()],
    secondaryMuscles: c.secondaryMuscles,
    instructions: c.instructions ?? [],
    overview: c.overview ?? "",
    exerciseTips: c.exerciseTips ?? [],
    variations: [],
    exerciseType: "",
    keywords: [],
    relatedExerciseIds: [],
    imageUrl: imageUrls["360p"],
    imageUrls,
    videoUrl: c.videoUrl ?? "",
    // Compat aliases
    bodyPart: c.category,
    equipment: c.equipment,
    gifUrl: c.gifUrl,
    target: c.targetMuscle,
  };
}

const detailCache = new Map<string, ExerciseDBExercise>();

export async function fetchExerciseDetail(
  exerciseId: string
): Promise<ExerciseDBExercise | null> {
  if (detailCache.has(exerciseId)) return detailCache.get(exerciseId)!;
  try {
    const res = await fetch(
      `${EXERCISEDB_BASE}/api/v1/exercises/${exerciseId}`,
      { headers: RAPIDAPI_HEADERS }
    );
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const raw = json as Record<string, unknown>;
    if (!raw) return null;
    const mapped = buildExercise(raw);
    detailCache.set(exerciseId, mapped);
    return mapped;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/** Search exercises by name (limit 10). Falls back to global cache silently. */
export async function searchExercises(
  queryStr: string
): Promise<ExerciseDBExercise[]> {
  try {
    const encoded = encodeURIComponent(queryStr.trim());
    const res = await fetch(
      `${EXERCISEDB_BASE}/api/v1/exercises/search?search=${encoded}&limit=10`,
      { headers: RAPIDAPI_HEADERS }
    );
    if (!res.ok) throw new Error(`ExerciseDB API error: ${res.status}`);
    const json: unknown = await res.json();
    const arr = Array.isArray(json)
      ? (json as Record<string, unknown>[])
      : Array.isArray((json as Record<string, unknown>)?.data)
      ? ((json as Record<string, unknown>).data as Record<string, unknown>[])
      : [];
    return arr.map(buildExercise);
  } catch (e) {
    console.warn(
      "[exerciseDbService] searchExercises API failed, using cache",
      e
    );
    const cached = await searchGlobalCache(queryStr);
    return cached.map(cachedToDBExercise);
  }
}

/** Fetch exercises by body part (limit 20). Falls back to global cache silently. */
export async function getByBodyPart(
  bodyPart: string
): Promise<ExerciseDBExercise[]> {
  try {
    const url = bodyPart
      ? `${EXERCISEDB_BASE}/api/v1/exercises?bodyParts=${encodeURIComponent(bodyPart)}&limit=20`
      : `${EXERCISEDB_BASE}/api/v1/exercises?limit=30`;
    const res = await fetch(url, { headers: RAPIDAPI_HEADERS });
    if (!res.ok) throw new Error(`ExerciseDB API error: ${res.status}`);
    const json: unknown = await res.json();
    const arr = Array.isArray(json)
      ? (json as Record<string, unknown>[])
      : Array.isArray((json as Record<string, unknown>)?.data)
      ? ((json as Record<string, unknown>).data as Record<string, unknown>[])
      : [];
    return arr.map(buildExercise);
  } catch (e) {
    console.warn(
      "[exerciseDbService] getByBodyPart API failed, using cache",
      e
    );
    const cached = await searchGlobalCache(bodyPart);
    return cached.map(cachedToDBExercise);
  }
}

/** List all available body parts. Falls back to empty silently. */
export async function getBodyPartList(): Promise<string[]> {
  try {
    const res = await fetch(`${EXERCISEDB_BASE}/api/v1/bodyparts`, {
      headers: RAPIDAPI_HEADERS,
    });
    if (!res.ok) throw new Error(`ExerciseDB API error: ${res.status}`);
    const json: unknown = await res.json();
    const arr = Array.isArray(json)
      ? (json as string[])
      : Array.isArray((json as Record<string, unknown>)?.data)
      ? ((json as Record<string, unknown>).data as string[])
      : [];
    return arr;
  } catch (e) {
    console.warn("[exerciseDbService] getBodyPartList API failed", e);
    return [];
  }
}
