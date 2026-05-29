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
import AsyncStorage from "@react-native-async-storage/async-storage";

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

// Display label → V2 API body part value(s). "Legs" and "Arms" map to two values each.
export const BODY_PART_MAP: Record<string, string[]> = {
  Chest: ["CHEST"],
  Back: ["BACK"],
  Legs: ["UPPER LEGS", "LOWER LEGS"],
  Shoulders: ["SHOULDERS"],
  Arms: ["UPPER ARMS", "LOWER ARMS"],
  Core: ["WAIST"],
  Glutes: ["GLUTES"],
  Cardio: ["CARDIO"],
  Mobility: ["NECK"],
};

// Display label → V2 API equipment value.
export const EQUIPMENT_MAP: Record<string, string> = {
  Barbell: "BARBELL",
  Dumbbell: "DUMBBELL",
  Cable: "CABLE",
  Machine: "LEVERAGE MACHINE",
  "Body Weight": "BODY WEIGHT",
  Kettlebell: "KETTLEBELL",
  "Resistance Band": "RESISTANCE BAND",
  "Smith Machine": "SMITH MACHINE",
  "EZ Bar": "EZ BARBELL",
};

// Module-level caches for list endpoints.
let _bodyPartListCache: string[] | null = null;
let _equipmentListCache: string[] | null = null;

const GLOBAL_EXERCISES_COLLECTION = "globalExercises";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ExercisePageResult = {
  exercises: ExerciseDBExercise[];
  nextCursor: string | null;
  hasNextPage: boolean;
};

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
// In-memory result cache (FIX 2) — 10-minute TTL
// ---------------------------------------------------------------------------

type CacheEntry = { result: ExercisePageResult; expiresAt: number };
const resultCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function getCached(key: string): ExercisePageResult | null {
  const entry = resultCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { resultCache.delete(key); return null; }
  return entry.result;
}

function setCached(key: string, result: ExercisePageResult): void {
  resultCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

// AsyncStorage keys and TTL for list endpoints (FIX 3)
const BODYPART_CACHE_KEY = "edb_bodypart_list";
const EQUIPMENT_CACHE_KEY = "edb_equipment_list";
const LIST_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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

/** Search exercises by name (limit 50). Falls back to global cache silently. */
export async function searchExercises(
  queryStr: string,
  cursor?: string
): Promise<ExercisePageResult> {
  const cacheKey = `search:${queryStr.trim().toLowerCase()}|cur:${cursor ?? ""}`;
  const hit = getCached(cacheKey);
  if (hit) return hit;

  try {
    const trimmed = queryStr.trim();
    // Build URL manually so encodeURIComponent is not double-encoded by URLSearchParams.
    let url = `${EXERCISEDB_BASE}/api/v1/exercises/search?search=${encodeURIComponent(trimmed)}&limit=50`;
    if (cursor) url += `&after=${encodeURIComponent(cursor)}`;

    const res = await fetch(url, { headers: RAPIDAPI_HEADERS });
    if (!res.ok) throw new Error(`ExerciseDB API error: ${res.status}`);
    const json: unknown = await res.json();
    const jsonObj = json as Record<string, unknown>;
    let arr: Record<string, unknown>[] = Array.isArray(json)
      ? (json as Record<string, unknown>[])
      : Array.isArray(jsonObj?.data)
      ? (jsonObj.data as Record<string, unknown>[])
      : [];
    let meta = (jsonObj?.meta ?? {}) as Record<string, unknown>;

    // If no results and query is multi-word, retry with only the first word.
    let firstWordCacheKey: string | null = null;
    if (arr.length === 0 && trimmed.includes(" ")) {
      const firstWord = trimmed.split(" ")[0];
      firstWordCacheKey = `search:${firstWord.toLowerCase()}|cur:`;
      const fallbackUrl = `${EXERCISEDB_BASE}/api/v1/exercises/search?search=${encodeURIComponent(firstWord)}&limit=50`;
      const fallbackRes = await fetch(fallbackUrl, { headers: RAPIDAPI_HEADERS });
      if (fallbackRes.ok) {
        const fallbackJson: unknown = await fallbackRes.json();
        const fallbackObj = fallbackJson as Record<string, unknown>;
        arr = Array.isArray(fallbackJson)
          ? (fallbackJson as Record<string, unknown>[])
          : Array.isArray(fallbackObj?.data)
          ? (fallbackObj.data as Record<string, unknown>[])
          : [];
        meta = (fallbackObj?.meta ?? {}) as Record<string, unknown>;
      }
    }

    const hasNextPage = Boolean(meta.hasNextPage);
    const nextCursor = hasNextPage ? ((meta.nextCursor as string | null) ?? null) : null;
    const result: ExercisePageResult = { exercises: arr.map(buildExercise), nextCursor, hasNextPage };
    setCached(cacheKey, result);
    if (firstWordCacheKey) setCached(firstWordCacheKey, result);
    return result;
  } catch (e) {
    console.warn(
      "[exerciseDbService] searchExercises API failed, using cache",
      e
    );
    const fallbackCached = await searchGlobalCache(queryStr);
    return { exercises: fallbackCached.map(cachedToDBExercise), nextCursor: null, hasNextPage: false };
  }
}

/** Fetch exercises by body part and/or equipment (limit 20, cursor-paginated). Falls back to global cache silently. */
export async function getByBodyPart(
  bodyPart: string,
  equipment?: string,
  cursor?: string
): Promise<ExercisePageResult> {
  try {
    const apiBodyParts = bodyPart ? BODY_PART_MAP[bodyPart] ?? null : null;
    const apiEquipment = equipment
      ? (EQUIPMENT_MAP[equipment] ?? equipment.toUpperCase())
      : null;

    // Multi-value body parts (Legs, Arms) — fire parallel requests and merge.
    if (apiBodyParts && apiBodyParts.length > 1) {
      const multiKey = `bp:${bodyPart}|eq:${apiEquipment ?? ""}|cur:${cursor ?? ""}`;
      const multiHit = getCached(multiKey);
      if (multiHit) return multiHit;

      const batches = await Promise.all(
        apiBodyParts.map(async (part) => {
          const params = new URLSearchParams();
          params.set("bodyParts", part);
          if (apiEquipment) params.set("equipments", apiEquipment);
          params.set("limit", "20");
          const url = `${EXERCISEDB_BASE}/api/v1/exercises?${params.toString()}`;
          const res = await fetch(url, { headers: RAPIDAPI_HEADERS });
          if (!res.ok) throw new Error(`ExerciseDB API error: ${res.status}`);
          const json: unknown = await res.json();
          const jsonObj = json as Record<string, unknown>;
          return Array.isArray(json)
            ? (json as Record<string, unknown>[])
            : Array.isArray(jsonObj?.data)
            ? (jsonObj.data as Record<string, unknown>[])
            : [];
        })
      );
      // Flatten and deduplicate by exerciseId.
      const seen = new Set<string>();
      const flat: Record<string, unknown>[] = [];
      for (const batch of batches) {
        for (const item of batch) {
          const id = String(
            (item as Record<string, unknown>).exerciseId ??
              (item as Record<string, unknown>).id ??
              ""
          );
          if (id && !seen.has(id)) {
            seen.add(id);
            flat.push(item);
          }
        }
      }
      const multiResult: ExercisePageResult = { exercises: flat.map(buildExercise), nextCursor: null, hasNextPage: false };
      setCached(multiKey, multiResult);
      return multiResult;
    }

    // Single body part (or "All").
    const singleBodyPart = apiBodyParts ? apiBodyParts[0] : "";
    const singleKey = `bp:${singleBodyPart}|eq:${apiEquipment ?? ""}|cur:${cursor ?? ""}`;
    const singleHit = getCached(singleKey);
    if (singleHit) return singleHit;

    const params = new URLSearchParams();
    if (apiBodyParts) params.set("bodyParts", apiBodyParts[0]);
    if (apiEquipment) params.set("equipments", apiEquipment);
    params.set("limit", "20");
    if (cursor) params.set("after", cursor);
    const url = `${EXERCISEDB_BASE}/api/v1/exercises?${params.toString()}`;
    const res = await fetch(url, { headers: RAPIDAPI_HEADERS });
    if (!res.ok) throw new Error(`ExerciseDB API error: ${res.status}`);
    const json: unknown = await res.json();
    const jsonObj = json as Record<string, unknown>;
    const arr = Array.isArray(json)
      ? (json as Record<string, unknown>[])
      : Array.isArray(jsonObj?.data)
      ? (jsonObj.data as Record<string, unknown>[])
      : [];
    const meta = (jsonObj?.meta ?? {}) as Record<string, unknown>;
    const hasNextPage = Boolean(meta.hasNextPage);
    const nextCursor = hasNextPage ? ((meta.nextCursor as string | null) ?? null) : null;
    const singleResult: ExercisePageResult = { exercises: arr.map(buildExercise), nextCursor, hasNextPage };
    setCached(singleKey, singleResult);
    return singleResult;
  } catch (e) {
    console.warn(
      "[exerciseDbService] getByBodyPart API failed, using cache",
      e
    );
    const fallbackCached = await searchGlobalCache(bodyPart);
    return { exercises: fallbackCached.map(cachedToDBExercise), nextCursor: null, hasNextPage: false };
  }
}

/** List all available body parts. Cached in memory then persisted to AsyncStorage (24 h). */
export async function getBodyPartList(): Promise<string[]> {
  if (_bodyPartListCache) return _bodyPartListCache;
  try {
    const stored = await AsyncStorage.getItem(BODYPART_CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { data: string[]; cachedAt: number };
      if (Date.now() - parsed.cachedAt < LIST_CACHE_TTL_MS) {
        _bodyPartListCache = parsed.data;
        return parsed.data;
      }
    }
  } catch {
    // Fall through to API fetch if storage read fails.
  }
  try {
    const res = await fetch(`${EXERCISEDB_BASE}/api/v1/bodyparts`, {
      headers: RAPIDAPI_HEADERS,
    });
    if (!res.ok) throw new Error(`ExerciseDB API error: ${res.status}`);
    const json: unknown = await res.json();
    const rawArr: unknown[] = Array.isArray(json)
      ? (json as unknown[])
      : Array.isArray((json as Record<string, unknown>)?.data)
      ? ((json as Record<string, unknown>).data as unknown[])
      : [];
    // Guarantee every element is a non-empty string regardless of API response shape.
    const arr = rawArr
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "object" && item !== null) {
          const obj = item as Record<string, unknown>;
          return String(obj.name ?? obj.bodyPart ?? obj.value ?? "");
        }
        return String(item);
      })
      .filter(Boolean) as string[];
    _bodyPartListCache = arr;
    try {
      await AsyncStorage.setItem(BODYPART_CACHE_KEY, JSON.stringify({ data: arr, cachedAt: Date.now() }));
    } catch {
      // Ignore storage write errors.
    }
    return arr;
  } catch (e) {
    console.warn("[exerciseDbService] getBodyPartList API failed", e);
    return [];
  }
}

/** List all available equipment types. Cached in memory then persisted to AsyncStorage (24 h). */
export async function getEquipmentList(): Promise<string[]> {
  if (_equipmentListCache) return _equipmentListCache;
  try {
    const stored = await AsyncStorage.getItem(EQUIPMENT_CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { data: string[]; cachedAt: number };
      if (Date.now() - parsed.cachedAt < LIST_CACHE_TTL_MS) {
        _equipmentListCache = parsed.data;
        return parsed.data;
      }
    }
  } catch {
    // Fall through to API fetch if storage read fails.
  }
  try {
    const res = await fetch(`${EXERCISEDB_BASE}/api/v1/equipments`, {
      headers: RAPIDAPI_HEADERS,
    });
    if (!res.ok) throw new Error(`ExerciseDB API error: ${res.status}`);
    const json: unknown = await res.json();
    const rawArr: unknown[] = Array.isArray(json)
      ? (json as unknown[])
      : Array.isArray((json as Record<string, unknown>)?.data)
      ? ((json as Record<string, unknown>).data as unknown[])
      : [];
    // Guarantee every element is a non-empty string regardless of API response shape.
    const arr = rawArr
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "object" && item !== null) {
          const obj = item as Record<string, unknown>;
          return String(obj.name ?? obj.equipment ?? obj.value ?? "");
        }
        return String(item);
      })
      .filter(Boolean) as string[];
    _equipmentListCache = arr;
    try {
      await AsyncStorage.setItem(EQUIPMENT_CACHE_KEY, JSON.stringify({ data: arr, cachedAt: Date.now() }));
    } catch {
      // Ignore storage write errors.
    }
    return arr;
  } catch (e) {
    console.warn("[exerciseDbService] getEquipmentList failed", e);
    return [];
  }
}
