import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import type { TrainingGroup, TrainingGroupType } from "../types/TrainingGroup";

const TRAINING_GROUPS_COLLECTION = "trainingGroups";

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

const assertNonEmpty = (value: string, label: string) => {
  if (!value || !value.trim()) throw new Error(`Missing ${label}.`);
};

const mapGroupDoc = (snap: QueryDocumentSnapshot): TrainingGroup => {
  const data = snap.data() as any;
  return {
    id: snap.id,
    studentId: String(data.studentId ?? ""),
    coachId: String(data.coachId ?? ""),
    name: String(data.name ?? ""),
    type: (data.type ?? "Custom") as TrainingGroupType,
    workoutsPerWeek:
      typeof data.workoutsPerWeek === "number" && Number.isFinite(data.workoutsPerWeek)
        ? data.workoutsPerWeek
        : Number(data.workoutsPerWeek ?? 0) || 0,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};

async function listTrainingGroups(constraints: QueryConstraint[]): Promise<TrainingGroup[]> {
  const q = query(collection(db, TRAINING_GROUPS_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapGroupDoc);
}

export const trainingGroupService = {
  presetTypes: [
    "Full Body",
    "Upper / Lower",
    "PPL",
    "Strength Block",
    "Hypertrophy",
    "Deload",
    "Conditioning",
    "Custom",
  ] as const,

  async createTrainingGroup(payload: {
    studentId: string;
    coachId: string;
    name: string;
    type: TrainingGroupType | string;
    workoutsPerWeek: number;
  }): Promise<TrainingGroup> {
    assertNonEmpty(payload.studentId, "studentId");
    assertNonEmpty(payload.coachId, "coachId");
    const name = payload.name.trim();
    if (!name) throw new Error("Group name is required.");
    const wpw = Number(payload.workoutsPerWeek);
    if (!Number.isFinite(wpw) || wpw < 1 || wpw > 14) {
      throw new Error("Workouts per week must be between 1 and 14.");
    }

    const now = new Date();
    const dataToWrite = sanitizeForFirestore({
      studentId: payload.studentId,
      coachId: payload.coachId,
      name,
      type: payload.type,
      workoutsPerWeek: Math.floor(wpw),
      createdAt: now,
      updatedAt: now,
    });

    const ref = await addDoc(collection(db, TRAINING_GROUPS_COLLECTION), dataToWrite);
    return {
      id: ref.id,
      studentId: payload.studentId,
      coachId: payload.coachId,
      name,
      type: payload.type,
      workoutsPerWeek: Math.floor(wpw),
      createdAt: now,
      updatedAt: now,
    };
  },

  async touchUpdatedAt(groupId: string): Promise<void> {
    assertNonEmpty(groupId, "groupId");
    const ref = doc(db, TRAINING_GROUPS_COLLECTION, groupId);
    await updateDoc(ref, sanitizeForFirestore({ updatedAt: new Date() }) as any);
  },

  async getTrainingGroupById(groupId: string): Promise<TrainingGroup | null> {
    assertNonEmpty(groupId, "groupId");
    const ref = doc(db, TRAINING_GROUPS_COLLECTION, groupId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return mapGroupDoc(snap as unknown as QueryDocumentSnapshot);
  },

  async deleteTrainingGroup(groupId: string, coachId: string): Promise<void> {
    assertNonEmpty(groupId, "groupId");
    assertNonEmpty(coachId, "coachId");
    const ref = doc(db, TRAINING_GROUPS_COLLECTION, groupId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data() as any;
    if (String(data.coachId ?? "") !== coachId) {
      throw new Error("You don't have access to this training group.");
    }
    await deleteDoc(ref);
  },

  async getTrainingGroupsForStudent(coachId: string, studentId: string): Promise<TrainingGroup[]> {
    assertNonEmpty(coachId, "coachId");
    assertNonEmpty(studentId, "studentId");
    // Best-effort newest-first ordering.
    try {
      return await listTrainingGroups([
        where("coachId", "==", coachId),
        where("studentId", "==", studentId),
        orderBy("updatedAt", "desc"),
      ]);
    } catch {
      const items = await listTrainingGroups([
        where("coachId", "==", coachId),
        where("studentId", "==", studentId),
      ]);
      return items.sort((a: any, b: any) => {
        const aMs = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
        const bMs = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
        return bMs - aMs;
      });
    }
  },

  async getLatestTrainingGroupForStudent(
    coachId: string,
    studentId: string
  ): Promise<TrainingGroup | null> {
    assertNonEmpty(coachId, "coachId");
    assertNonEmpty(studentId, "studentId");
    try {
      const items = await listTrainingGroups([
        where("coachId", "==", coachId),
        where("studentId", "==", studentId),
        orderBy("updatedAt", "desc"),
        limit(1),
      ]);
      return items[0] ?? null;
    } catch {
      const items = await trainingGroupService.getTrainingGroupsForStudent(coachId, studentId);
      return items[0] ?? null;
    }
  },
};

