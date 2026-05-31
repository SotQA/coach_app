import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { ExerciseCard, type ExerciseDraft } from "../../components/ExerciseCard";
import { ExerciseLibraryModal } from "../../components/ExerciseLibraryModal";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenLayout } from "../../components/ScreenLayout";
import { useAuth } from "../../context/AuthContext";
import { exerciseTemplateService } from "../../services/exerciseTemplateService";
import { workoutService } from "../../services/workoutService";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import type { Exercise } from "../../types/Workout";

export default function CreatePersonalPlan() {
  const router = useRouter();
  const { user } = useAuth();

  const [planName, setPlanName] = useState("");
  const [note, setNote] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [exercises, setExercises] = useState<ExerciseDraft[]>(() => {
    const base = workoutService.createEmptyExercise();
    return [{ _key: String(Date.now()), ...base, coachNote: "" }];
  });
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [lastAddedKey, setLastAddedKey] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState(0);

  useEffect(() => {
    if (!user) return;
    workoutService.getActiveWorkoutPlansForStudent(user.id).then((existing) => {
      const maxOrder = existing.reduce((max, p) => {
        const n = typeof p.order === "number" && Number.isFinite(p.order) ? p.order : -1;
        return Math.max(max, n);
      }, -1);
      setOrder(maxOrder + 1);
    }).catch(() => {});
  }, [user?.id]);

  const updateExercise = (key: string, patch: Partial<ExerciseDraft>) => {
    setExercises((prev) => prev.map((e) => (e._key === key ? { ...e, ...patch } : e)));
  };

  const addExerciseFromLibrary = (payload: { name: string; exerciseDbId?: string }) => {
    const base = workoutService.createEmptyExercise();
    const nextKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setExercises((prev) => [...prev, { _key: nextKey, ...base, name: payload.name, coachNote: "", exerciseDbId: payload.exerciseDbId }]);
    setLastAddedKey(nextKey);
    setExpandedKey(nextKey);
  };

  const handleSave = async () => {
    if (!user) return;
    setError(null);
    setLoading(true);
    try {
      const name = planName.trim();
      if (!name) throw new Error("Workout name is required.");
      if (name.length > 50) throw new Error("Workout name must be at most 50 characters.");
      if (note.trim().length > 500) throw new Error("Notes must be at most 500 characters.");

      const durationTrim = estimatedMinutes.trim();
      const durationNum =
        durationTrim === "" ? undefined : Math.max(0, Math.floor(Number(durationTrim)));
      if (durationTrim !== "" && !Number.isFinite(Number(durationTrim))) {
        throw new Error("Estimated duration must be a number of minutes.");
      }

      const sanitizedExercises: Exercise[] = exercises
        .map((e) => ({
          name: (e.name ?? "").trim(),
          sets: Number(e.sets ?? 0),
          reps: (e.reps ?? "").trim(),
          weight: e.weight,
          rest: (e.rest ?? "").trim(),
          tempo: (e.tempo ?? "").trim(),
          rpe: e.rpe === null || e.rpe === undefined ? null : e.rpe,
          coachNote: (e.coachNote ?? "").trim() || undefined,
          videoUrl: (e.videoUrl ?? "").trim() || undefined,
          exerciseDbId: e.exerciseDbId || undefined,
        }))
        .filter((e) => e.name.length > 0);

      if (sanitizedExercises.length === 0) throw new Error("Add at least one exercise.");

      for (const ex of sanitizedExercises) {
        if (!Number.isFinite(ex.sets) || ex.sets <= 0) throw new Error(`Sets for "${ex.name}" must be > 0.`);
        if (ex.rpe !== null && (!Number.isFinite(ex.rpe) || ex.rpe < 1 || ex.rpe > 10)) {
          throw new Error(`RPE for "${ex.name}" must be between 1 and 10.`);
        }
      }

      await workoutService.createWorkoutPlan({
        coachId: user.id,
        studentId: user.id,
        groupId: "personal",
        groupName: "Personal",
        name,
        exercises: sanitizedExercises,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        order,
        note: note.trim() || undefined,
        estimatedDurationMinutes: durationNum,
      });

      await Promise.all(sanitizedExercises.map((e) => exerciseTemplateService.upsertNameIfNeeded(e.name)));
      router.replace("/coach/myTraining" as any);
    } catch (e: any) {
      setError(e.message ?? "Failed to save workout plan.");
    } finally {
      setLoading(false);
    }
  };

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
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: 140 }}
          ListHeaderComponent={
            <>
              <View style={{ marginBottom: Spacing.md }}>
                <Text style={{ ...Typography.title, marginBottom: 4 }}>New Personal Plan</Text>
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
                <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Workout name</Text>
                <TextInput
                  placeholder="e.g. Push Day"
                  placeholderTextColor={Colors.textMuted}
                  value={planName}
                  onChangeText={(t) => setPlanName(t.slice(0, 50))}
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

                <View style={{ flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Order</Text>
                    <TextInput
                      placeholder="0"
                      placeholderTextColor={Colors.textMuted}
                      value={String(order)}
                      onChangeText={(t) => {
                        const n = Number(t.trim().replace(/[^0-9]/g, ""));
                        setOrder(Number.isFinite(n) ? Math.max(0, n) : 0);
                      }}
                      keyboardType="number-pad"
                      style={{
                        borderWidth: 1,
                        borderColor: Colors.border,
                        padding: 12,
                        borderRadius: Radius.md,
                        color: Colors.text,
                        backgroundColor: Colors.surface,
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Est. minutes</Text>
                    <TextInput
                      placeholder="60"
                      placeholderTextColor={Colors.textMuted}
                      value={estimatedMinutes}
                      onChangeText={setEstimatedMinutes}
                      keyboardType="number-pad"
                      style={{
                        borderWidth: 1,
                        borderColor: Colors.border,
                        padding: 12,
                        borderRadius: Radius.md,
                        color: Colors.text,
                        backgroundColor: Colors.surface,
                      }}
                    />
                  </View>
                </View>

                <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Notes (optional)</Text>
                <TextInput
                  placeholder="Goals, cues, constraints…"
                  placeholderTextColor={Colors.textMuted}
                  value={note}
                  onChangeText={(t) => setNote(t.slice(0, 500))}
                  multiline
                  style={{
                    borderWidth: 1,
                    borderColor: Colors.border,
                    padding: 12,
                    borderRadius: Radius.md,
                    color: Colors.text,
                    backgroundColor: Colors.surface,
                    minHeight: 80,
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
                <Text style={{ ...Typography.section, fontWeight: "900" }}>Exercises</Text>
                <PrimaryButton
                  title="+ Add Exercise"
                  onPress={() => setLibraryOpen(true)}
                  style={{ width: "auto", paddingHorizontal: Spacing.md }}
                />
              </View>
            </>
          }
          ListFooterComponent={
            error ? (
              <Text style={{ color: Colors.danger, marginTop: Spacing.xs }}>{error}</Text>
            ) : (
              <View style={{ height: 1 }} />
            )
          }
          renderItem={({ item, drag, isActive, getIndex }: RenderItemParams<ExerciseDraft>) => {
            const idx = getIndex?.() ?? 0;
            return (
              <View style={{ marginBottom: Spacing.sm, opacity: isActive ? 0.9 : 1 }}>
                <ExerciseCard
                  value={item}
                  index={idx}
                  expanded={expandedKey === item._key}
                  autoFocusName={
                    item._key === lastAddedKey &&
                    expandedKey === item._key &&
                    (item.name ?? "").trim() === ""
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
            );
          }}
        />
      </KeyboardAvoidingView>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: Spacing.md,
          backgroundColor: Colors.bg,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
        }}
      >
        {loading ? <ActivityIndicator /> : <PrimaryButton title="Save Plan" onPress={handleSave} />}
      </View>

      {user ? (
        <ExerciseLibraryModal
          visible={libraryOpen}
          coachId={user.id}
          onClose={() => setLibraryOpen(false)}
          onAddExercise={(p) => addExerciseFromLibrary({ name: p.name, exerciseDbId: p.exerciseDbId })}
        />
      ) : null}
    </ScreenLayout>
  );
}
