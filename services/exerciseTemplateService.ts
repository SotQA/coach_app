import { addDoc, collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

const COLLECTION = "exerciseTemplates";

export type ExerciseTemplate = {
  id: string;
  name: string;
};

function mapDoc(id: string, data: any): ExerciseTemplate {
  return {
    id,
    name: data?.name != null ? String(data.name).trim() : "",
  };
}

async function scanAndFilter(lowerPrefix: string, max: number): Promise<ExerciseTemplate[]> {
  const ref = collection(db, COLLECTION);
  const snap = await getDocs(query(ref, limit(400)));
  const all = snap.docs
    .map((d) => mapDoc(d.id, d.data()))
    .filter((t) => t.name.toLowerCase().startsWith(lowerPrefix));
  return all.slice(0, max);
}

/** Case-insensitive prefix search (scans up to 400 templates; no index required). */
export const exerciseTemplateService = {
  async searchByPrefix(prefix: string, max = 12): Promise<ExerciseTemplate[]> {
    const q = prefix.trim().toLowerCase();
    if (!q) return [];
    return scanAndFilter(q, max);
  },

  /** Create a template doc if the name is non-empty (best-effort for autocomplete corpus). */
  async upsertNameIfNeeded(rawName: string): Promise<void> {
    const name = String(rawName ?? "").trim();
    if (name.length < 2) return;

    try {
      const ref = collection(db, COLLECTION);
      const snap = await getDocs(query(ref, where("name", "==", name), limit(1)));
      if (!snap.empty) return;
      await addDoc(ref, { name });
    } catch (e) {
      console.warn("[exerciseTemplateService] upsertNameIfNeeded", e);
    }
  },
};
