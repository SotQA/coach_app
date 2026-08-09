import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { ExerciseCard, type ExerciseDraft } from "../../components/ExerciseCard";
import { ExerciseLibraryModal } from "../../components/ExerciseLibraryModal";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenLayout } from "../../components/ScreenLayout";
import { useAuth } from "../../context/AuthContext";
import { useHideCoachFabOnFocus } from "../../context/CoachFabVisibilityContext";
import { workoutService } from "../../services/workoutService";
import { studentService } from "../../services/studentService";
import { exerciseTemplateService } from "../../services/exerciseTemplateService";
import type { Exercise } from "../../types/Workout";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";
import { getDisplayName } from "../../utils/userDisplay";
import { logger } from "@/utils/logger";

const toDraft = (e: Exercise): ExerciseDraft => ({
  _key: e.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  name: e.name,
  sets: e.sets,
  reps: e.reps,
  weight: e.weight,
  rest: e.rest,
  tempo: e.tempo,
  rpe: e.rpe,
  coachNote: e.coachNote ?? "",
  videoUrl: e.videoUrl ?? "",
  exerciseDbId: e.exerciseDbId,
});

export default function EditWorkout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  useHideCoachFabOnFocus();
  const params = useLocalSearchParams<{ workoutPlanId?: string }>();
  const workoutPlanId = useMemo(() => String(params.workoutPlanId ?? "").trim(), [params]);

  const [planName, setPlanName] = useState("");
  const [planNote, setPlanNote] = useState("");
  const [coachMessage, setCoachMessage] = useState("");
  const [studentDisplayName, setStudentDisplayName] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExerciseDraft[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [lastAddedKey, setLastAddedKey] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coachId, setCoachId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      logger.log("[coach/editWorkout] load start", { workoutPlanId });
      setLoading(true);
      try {
        setError(null);

        if (!workoutPlanId) {
          setError("Missing workoutPlanId.");
          return;
        }

        if (!user || user.role !== "coach") {
          setError("You must be logged in as a coach.");
          return;
        }
        setCoachId(user.id);

        const plan = await workoutService.getWorkoutPlanById(workoutPlanId);
        if (!plan) {
          setError("Workout plan not found.");
          return;
        }
        if (plan.coachId !== user.id) {
          setError("You don't have access to this workout plan.");
          return;
        }

        setPlanName(plan.name ?? "Workout Plan");
        setPlanNote(plan.note?.trim() ?? "");
        const initial =
          Array.isArray(plan.exercises) && plan.exercises.length ? plan.exercises : [workoutService.createEmptyExercise()];
        setExercises(initial.map(toDraft));

        if (plan.studentId) {
          const student = await studentService.getStudentById(plan.studentId).catch(() => null);
          if (student) setStudentDisplayName(getDisplayName(student, "the student"));
        }
      } catch (e: any) {
        console.error("[coach/editWorkout] load error", e);
        setError(e.message ?? "Failed to load workout plan.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [workoutPlanId, user?.id, user?.role]);

  const updateExercise = (key: string, patch: Partial<ExerciseDraft>) => {
    setExercises((prev) => prev.map((e) => (e._key === key ? { ...e, ...patch } : e)));
  };

  const addExerciseFromLibrary = (payload: { name: string; exerciseDbId?: string }) => {
    const base = workoutService.createEmptyExercise();
    const nextKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const next: ExerciseDraft = {
      _key: nextKey,
      ...base,
      name: payload.name,
      coachNote: "",
      exerciseDbId: payload.exerciseDbId,
    };
    setExercises((prev) => [...prev, next]);
    setLastAddedKey(nextKey);
    setExpandedKey(nextKey);
  };

  const handleSave = async () => {
    if (!coachId || !workoutPlanId) return;
    setSaving(true);
    setError(null);
    try {
      const trimmedName = planName.trim() || "Workout Plan";
      if (planNote.trim().length > 500) throw new Error("Coach notes must be at most 500 characters.");
      if (coachMessage.trim().length > 500) throw new Error("Message to student must be at most 500 characters.");

      const normalizedExercises: Exercise[] = exercises
        .map((e) => {
          const rest = (e.rest ?? "").trim();
          const tempo = (e.tempo ?? "").trim();
          const rpe = e.rpe === null || e.rpe === undefined ? null : e.rpe;

          return {
            id: e._key,
            name: (e.name ?? "").trim(),
            sets: Number(e.sets ?? 0),
            reps: (e.reps ?? "").trim(),
            weight: e.weight,
            rest,
            tempo,
            rpe: rpe === null ? null : rpe,
            coachNote: (e.coachNote ?? "").trim() || undefined,
            videoUrl: (e.videoUrl ?? "").trim() || undefined,
            exerciseDbId: e.exerciseDbId || undefined,
          };
        })
        .filter((e) => e.name.length > 0);

      if (normalizedExercises.length === 0) {
        throw new Error("A workout must have at least one exercise.");
      }

      for (const ex of normalizedExercises) {
        if (!Number.isFinite(ex.sets) || ex.sets <= 0) {
          throw new Error(`Sets for "${ex.name}" must be > 0.`);
        }
        if (ex.rest !== "") {
          const n = Number(ex.rest);
          if (!Number.isFinite(n) || n < 0) {
            throw new Error(`Rest for "${ex.name}" must be a number >= 0.`);
          }
        }
        if (ex.tempo.length > 20) {
          throw new Error(`Tempo for "${ex.name}" must be at most 20 characters.`);
        }
        if (ex.rpe !== null) {
          if (!Number.isFinite(ex.rpe) || ex.rpe < 1 || ex.rpe > 10) {
            throw new Error(`RPE for "${ex.name}" must be between 1 and 10.`);
          }
        }
        if (ex.weight != null) {
          const w = Number(ex.weight);
          if (!Number.isFinite(w) || w < 0) {
            throw new Error(`Weight for "${ex.name}" must be a number >= 0.`);
          }
        }
      }

      await workoutService.updateWorkoutPlan(
        workoutPlanId,
        coachId,
        {
          name: trimmedName,
          exercises: normalizedExercises,
          note: planNote.trim(),
        },
        coachMessage.trim() || undefined
      );

      await Promise.all(
        normalizedExercises.map((e) => exerciseTemplateService.upsertNameIfNeeded(e.name))
      );

      router.back();
    } catch (e: any) {
      setError(e.message ?? "Failed to save workout plan.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error && !exercises.length) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: Spacing.md, backgroundColor: Colors.bg }}>
        <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>{error}</Text>
      </View>
    );
  }

  const studentLabel = studentDisplayName ?? "the student";

  return (
    <ScreenLayout>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: Colors.bg }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <DraggableFlatList
          data={exercises}
          keyExtractor={(item) => item._key}
          onDragEnd={({ data }) => setExercises(data)}
          activationDistance={12}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: 160 }}
          ListHeaderComponent={
            <>
              <View style={{ marginBottom: Spacing.md }}>
                <Text style={{ ...Typography.title, fontSize: FontSizes.h2, marginBottom: 6 }}>Edit Workout</Text>
              </View>

              <View
                style={{
                  backgroundColor: Colors.card,
                  borderRadius: Radius.lg,
                  padding: Spacing.lg,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  marginBottom: Spacing.md,
                }}
              >
                <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Plan name</Text>
                <TextInput
                  value={planName}
                  onChangeText={(t) => setPlanName(t.slice(0, 50))}
                  placeholder="Workout Plan"
                  placeholderTextColor={Colors.textMuted}
                  style={{
                    borderWidth: 1,
                    borderColor: Colors.border,
                    padding: 12,
                    borderRadius: Radius.md,
                    marginBottom: Spacing.sm,
                    color: Colors.text,
                    backgroundColor: Colors.surface,
                  }}
                />

                <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Coach note (optional)</Text>
                <TextInput
                  value={planNote}
                  onChangeText={(t) => setPlanNote(t.slice(0, 500))}
                  placeholder="Intent, cues, or progression notes…"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  style={{
                    borderWidth: 1,
                    borderColor: Colors.border,
                    padding: 12,
                    borderRadius: Radius.md,
                    color: Colors.text,
                    backgroundColor: Colors.surface,
                    minHeight: 72,
                  }}
                />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: Spacing.sm,
                }}
              >
                <Text style={{ ...Typography.section, fontWeight: "900" }}>
                  {exercises.length} exercise{exercises.length === 1 ? "" : "s"} · drag to reorder
                </Text>
                <PrimaryButton
                  title="+ Add"
                  onPress={() => setLibraryOpen(true)}
                  style={{ width: "auto", paddingHorizontal: Spacing.md }}
                />
              </View>
            </>
          }
          ListFooterComponent={
            <View style={{ marginTop: Spacing.sm }}>
              <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Message to {studentLabel} (optional)</Text>
              <TextInput
                value={coachMessage}
                onChangeText={(t) => setCoachMessage(t.slice(0, 500))}
                placeholder="What changed and why…"
                placeholderTextColor={Colors.textMuted}
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: Colors.border,
                  padding: 12,
                  borderRadius: Radius.md,
                  color: Colors.text,
                  backgroundColor: Colors.surface,
                  minHeight: 64,
                  marginBottom: Spacing.xs,
                }}
              />
              <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontSize: FontSizes.tiny, textAlign: "center" }}>
                {studentLabel} will be notified of what changed
              </Text>
              {error ? (
                <Text style={{ color: Colors.danger, marginTop: Spacing.sm, textAlign: "center" }}>{error}</Text>
              ) : null}
            </View>
          }
          renderItem={({ item, drag, isActive, getIndex }: RenderItemParams<ExerciseDraft>) => (
            <View style={{ marginBottom: Spacing.sm, opacity: isActive ? 0.9 : 1 }}>
              <ExerciseCard
                value={item}
                index={getIndex?.() ?? 0}
                expanded={expandedKey === item._key}
                autoFocusName={
                  item._key === lastAddedKey && expandedKey === item._key && (item.name ?? "").trim() === ""
                }
                onToggleExpanded={() =>
                  setExpandedKey((prev) => {
                    const next = prev === item._key ? null : item._key;
                    if (next !== item._key) setLastAddedKey(null);
                    return next;
                  })
                }
                onChange={(next) => updateExercise(item._key, next)}
                onDuplicate={() => {
                  const clone: ExerciseDraft = {
                    ...item,
                    _key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                  };
                  setExercises((prev) => {
                    const i = prev.findIndex((p) => p._key === item._key);
                    if (i < 0) return [...prev, clone];
                    const copy = prev.slice();
                    copy.splice(i + 1, 0, clone);
                    return copy;
                  });
                  setExpandedKey(clone._key);
                  setLastAddedKey(clone._key);
                }}
                onDelete={() => {
                  setExercises((prev) => prev.filter((p) => p._key !== item._key));
                  setExpandedKey((prev) => (prev === item._key ? null : prev));
                  setLastAddedKey((prev) => (prev === item._key ? null : prev));
                }}
                dragHandleProps={{ onLongPress: drag }}
              />
            </View>
          )}
        />
      </KeyboardAvoidingView>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: Spacing.md,
          paddingBottom: Math.max(insets.bottom, Spacing.md),
          backgroundColor: Colors.bg,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
        }}
      >
        {saving ? <ActivityIndicator /> : <PrimaryButton title="Save changes" onPress={handleSave} />}
      </View>

      {coachId ? (
        <ExerciseLibraryModal
          visible={libraryOpen}
          coachId={coachId}
          onClose={() => setLibraryOpen(false)}
          onAddExercise={(p) => addExerciseFromLibrary({ name: p.name, exerciseDbId: p.exerciseDbId })}
        />
      ) : null}
    </ScreenLayout>
  );
}
