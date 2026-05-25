import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import type { ExerciseTemplateFirestoreDoc } from "../types/firestore";
import type { CachedExercise } from "./exerciseDbService";
import { cacheMappedExerciseToFirestore } from "./exerciseDbService";

const COLLECTION = "exerciseTemplates";
const GLOBAL_EXERCISES_COLLECTION = "globalExercises";

function sanitizeForFirestore<T>(value: T): T {
  if (value === undefined) return value;
  if (value === null) return value;
  if (Array.isArray(value)) {
    const cleaned = value
      .map((v) => sanitizeForFirestore(v))
      .filter((v) => v !== undefined);
    return cleaned as unknown as T;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const sv = sanitizeForFirestore(v);
      if (sv !== undefined) cleaned[k] = sv;
    }
    return cleaned as unknown as T;
  }
  return value;
}

export type ExerciseTemplate = {
  id: string;
  name: string;
  coachId?: string;
  category?: string;
  equipment?: string;
  createdAt?: any;
  usageCount?: number;
  lastUsedAt?: any;
  source?: "custom" | "exerciseDB";
  exerciseDbId?: string;
  gifUrl?: string;
  targetMuscle?: string;
  secondaryMuscles?: string[];
  instructions?: string[];
};

function mapDoc(
  id: string,
  data: ExerciseTemplateFirestoreDoc | undefined
): ExerciseTemplate {
  return {
    id,
    name: data?.name != null ? String(data.name).trim() : "",
    coachId: data?.coachId != null ? String(data.coachId) : undefined,
    category: data?.category != null ? String(data.category) : undefined,
    equipment: data?.equipment != null ? String(data.equipment) : undefined,
    createdAt: data?.createdAt,
    usageCount:
      data?.usageCount != null && Number.isFinite(Number(data.usageCount))
        ? Number(data.usageCount)
        : undefined,
    lastUsedAt: data?.lastUsedAt,
    source: data?.source,
    exerciseDbId:
      data?.exerciseDbId != null ? String(data.exerciseDbId) : undefined,
    gifUrl: data?.gifUrl != null ? String(data.gifUrl) : undefined,
    targetMuscle:
      data?.targetMuscle != null ? String(data.targetMuscle) : undefined,
    secondaryMuscles: Array.isArray(data?.secondaryMuscles)
      ? (data.secondaryMuscles as string[])
      : undefined,
    instructions: Array.isArray(data?.instructions)
      ? (data.instructions as string[])
      : undefined,
  };
}

async function scanAndFilter(
  lowerPrefix: string,
  max: number
): Promise<ExerciseTemplate[]> {
  const ref = collection(db, COLLECTION);
  const snap = await getDocs(query(ref, limit(400)));
  const all = snap.docs
    .map((d) => mapDoc(d.id, d.data()))
    .filter((t) => t.name.toLowerCase().startsWith(lowerPrefix));
  return all.slice(0, max);
}

/** Query /globalExercises for exercises matching the prefix and return as ExerciseTemplate. */
async function scanGlobalExercises(
  lowerPrefix: string,
  max: number
): Promise<ExerciseTemplate[]> {
  try {
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
          source: "exerciseDB" as const,
          exerciseDbId: d.id,
          gifUrl: data.gifUrl != null ? String(data.gifUrl) : undefined,
          targetMuscle:
            data.targetMuscle != null ? String(data.targetMuscle) : undefined,
          secondaryMuscles: Array.isArray(data.secondaryMuscles)
            ? (data.secondaryMuscles as string[])
            : undefined,
          instructions: Array.isArray(data.instructions)
            ? (data.instructions as string[])
            : undefined,
        };
      })
      .filter((t) => t.name.toLowerCase().startsWith(lowerPrefix))
      .slice(0, max);
  } catch (e) {
    console.warn("[exerciseTemplateService] scanGlobalExercises error", e);
    return [];
  }
}

/** Case-insensitive prefix search (scans up to 400 templates; no index required). */
export const exerciseTemplateService = {
  /**
   * Case-insensitive prefix search across both coach templates and the global
   * ExerciseDB cache. Results are deduplicated by name.
   */
  async searchByPrefix(prefix: string, max = 12): Promise<ExerciseTemplate[]> {
    const q = prefix.trim().toLowerCase();
    if (!q) return [];

    const [localResults, globalResults] = await Promise.all([
      scanAndFilter(q, max),
      scanGlobalExercises(q, max),
    ]);

    // Merge, deduplicated by lowercase name (local results take precedence).
    const seen = new Set(localResults.map((t) => t.name.toLowerCase()));
    const merged = [...localResults];
    for (const t of globalResults) {
      if (!seen.has(t.name.toLowerCase())) {
        seen.add(t.name.toLowerCase());
        merged.push(t);
      }
    }
    return merged.slice(0, max);
  },

  /** Create a template doc if the name is non-empty (best-effort for autocomplete corpus). */
  async upsertNameIfNeeded(rawName: string): Promise<void> {
    const name = String(rawName ?? "").trim();
    if (name.length < 2) return;

    try {
      const ref = collection(db, COLLECTION);
      const snap = await getDocs(
        query(ref, where("name", "==", name), limit(1))
      );
      if (!snap.empty) return;
      // Firestore rejects undefined fields; always sanitize writes.
      await addDoc(ref, sanitizeForFirestore({ name }) as any);
    } catch (e) {
      console.warn("[exerciseTemplateService] upsertNameIfNeeded", e);
    }
  },

  normalizeName(rawName: string): string {
    return String(rawName ?? "")
      .trim()
      .replace(/\s+/g, " ");
  },

  /**
   * Returns templates for a coach (best-effort). Falls back to scanning for legacy docs.
   */
  async listForCoach(coachId: string, max = 500): Promise<ExerciseTemplate[]> {
    const ref = collection(db, COLLECTION);
    try {
      const snap = await getDocs(
        query(ref, where("coachId", "==", coachId), limit(max))
      );
      return snap.docs.map((d) => mapDoc(d.id, d.data()));
    } catch {
      // Legacy: scan a slice and filter.
      const snap = await getDocs(query(ref, limit(max)));
      return snap.docs
        .map((d) => mapDoc(d.id, d.data()))
        .filter((t) => !t.coachId || t.coachId === coachId);
    }
  },

  /**
   * Create a custom template with duplicate prevention (case-insensitive, per coach).
   */
  async createCustomTemplate(payload: {
    coachId: string;
    name: string;
    category: string;
    equipment?: string;
  }): Promise<ExerciseTemplate> {
    const coachId = String(payload.coachId ?? "").trim();
    const name = exerciseTemplateService.normalizeName(payload.name);
    const category = String(payload.category ?? "").trim();
    const equipment = String(payload.equipment ?? "").trim();
    if (!coachId) throw new Error("Missing coachId.");
    if (name.length < 2) throw new Error("Exercise name is required.");
    if (!category) throw new Error("Category is required.");

    const ref = collection(db, COLLECTION);
    const snap = await getDocs(
      query(
        ref,
        where("coachId", "==", coachId),
        where("name", "==", name),
        limit(1)
      )
    );
    if (!snap.empty) {
      const d = snap.docs[0];
      return mapDoc(d.id, d.data());
    }

    const now = new Date();
    const docRef = await addDoc(
      ref,
      sanitizeForFirestore({
        coachId,
        name,
        category,
        equipment: equipment || undefined,
        createdAt: now,
        usageCount: 0,
        lastUsedAt: now,
      }) as any
    );
    return {
      id: docRef.id,
      coachId,
      name,
      category,
      equipment: equipment || undefined,
      createdAt: now,
      usageCount: 0,
      lastUsedAt: now,
    };
  },

  /**
   * Add a template from ExerciseDB. Checks for duplicates by exerciseDbId before
   * inserting. Also caches the exercise to /globalExercises.
   */
  async addFromExerciseDB(
    coachId: string,
    exercise: CachedExercise
  ): Promise<ExerciseTemplate> {
    const ref = collection(db, COLLECTION);

    // Check for existing template with the same exerciseDbId for this coach.
    const dupSnap = await getDocs(
      query(
        ref,
        where("coachId", "==", coachId),
        where("exerciseDbId", "==", exercise.id),
        limit(1)
      )
    );
    if (!dupSnap.empty) {
      return mapDoc(dupSnap.docs[0].id, dupSnap.docs[0].data());
    }

    // Ensure the exercise is cached in the global collection.
    cacheMappedExerciseToFirestore(exercise).catch(() => {});

    const now = new Date();
    const docRef = await addDoc(
      ref,
      sanitizeForFirestore({
        coachId,
        name: exercise.name,
        category: exercise.category,
        equipment: exercise.equipment,
        source: "exerciseDB",
        exerciseDbId: exercise.id,
        gifUrl: exercise.gifUrl,
        targetMuscle: exercise.targetMuscle,
        secondaryMuscles: exercise.secondaryMuscles,
        instructions: exercise.instructions,
        createdAt: now,
        usageCount: 0,
        lastUsedAt: now,
      }) as any
    );

    return {
      id: docRef.id,
      coachId,
      name: exercise.name,
      category: exercise.category,
      equipment: exercise.equipment,
      source: "exerciseDB",
      exerciseDbId: exercise.id,
      gifUrl: exercise.gifUrl,
      targetMuscle: exercise.targetMuscle,
      secondaryMuscles: exercise.secondaryMuscles,
      instructions: exercise.instructions,
      createdAt: now,
      usageCount: 0,
      lastUsedAt: now,
    };
  },

  /**
   * Increment usage counters for templates (creates coach-scoped doc if missing).
   */
  async recordUsage(payload: {
    coachId: string;
    name: string;
    category?: string;
    equipment?: string;
  }): Promise<void> {
    const coachId = String(payload.coachId ?? "").trim();
    const name = exerciseTemplateService.normalizeName(payload.name);
    if (!coachId || name.length < 2) return;

    const ref = collection(db, COLLECTION);
    const snap = await getDocs(
      query(
        ref,
        where("coachId", "==", coachId),
        where("name", "==", name),
        limit(1)
      )
    );
    const now = new Date();
    if (snap.empty) {
      await addDoc(
        ref,
        sanitizeForFirestore({
          coachId,
          name,
          category: payload.category || undefined,
          equipment: payload.equipment || undefined,
          createdAt: now,
          usageCount: 1,
          lastUsedAt: now,
        }) as any
      );
      return;
    }
    const d = snap.docs[0];
    const current = d.data() as ExerciseTemplateFirestoreDoc | undefined;
    const nextCount =
      current?.usageCount != null && Number.isFinite(Number(current.usageCount))
        ? Number(current.usageCount) + 1
        : 1;
    await updateDoc(
      doc(db, COLLECTION, d.id),
      sanitizeForFirestore({
        usageCount: nextCount,
        lastUsedAt: now,
        category: current?.category ?? payload.category ?? undefined,
        equipment: current?.equipment ?? payload.equipment ?? undefined,
      }) as any
    );
  },
};
