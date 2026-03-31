import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";
import { PrimaryButton } from "../../components/PrimaryButton";
import { useAuth } from "../../context/AuthContext";
import { trainingGroupService } from "../../services/trainingGroupService";
import { workoutService } from "../../services/workoutService";
import { exerciseTemplateService } from "../../services/exerciseTemplateService";
import type { Exercise } from "../../types/Workout";
import type { TrainingGroup } from "../../types/TrainingGroup";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { ScreenLayout } from "../../components/ScreenLayout";
import { ExerciseCard, type ExerciseDraft } from "../../components/ExerciseCard";
import { ExerciseLibraryModal } from "../../components/ExerciseLibraryModal";

// Screen for coaches to build a workout plan for a specific student.
export default function CreateWorkoutPlan() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    studentId?: string;
    studentName?: string;
    groupId?: string;
  }>();

  const [studentName] = useState(params.studentName ?? "Student");
  const [studentId] = useState(params.studentId ?? "");
  const [selectedGroup, setSelectedGroup] = useState<TrainingGroup | null>(null);
  const [planName, setPlanName] = useState("");
  const [note, setNote] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [exercises, setExercises] = useState<ExerciseDraft[]>(() => {
    const base = workoutService.createEmptyExercise();
    return [
      {
        _key: String(Date.now()),
        ...base,
        coachNote: "",
      },
    ];
  });
  // Keep everything collapsed on initial open (avoid auto-focus/keyboard pop).
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [lastAddedKey, setLastAddedKey] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initializingUser, setInitializingUser] = useState(true);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<number>(0);

  useEffect(() => {
    const init = async () => {
      try {
        if (!user || user.role !== "coach") {
          setError("You must be logged in as a coach.");
          return;
        }
        setCoachId(user.id);

        if (!studentId) {
          setError("Missing student context.");
          return;
        }

        const groupId = String(params.groupId ?? "").trim();
        if (!groupId) {
          // Redirect into the focused group selection flow.
          router.replace({
            pathname: "/coach/selectTrainingGroup",
            params: { studentId, studentName },
          });
          return;
        }

        const group = await trainingGroupService.getTrainingGroupById(groupId);
        if (!group || group.coachId !== user.id || group.studentId !== studentId) {
          router.replace({
            pathname: "/coach/selectTrainingGroup",
            params: { studentId, studentName },
          });
          return;
        }
        setSelectedGroup(group);

        // Best-effort default ordering: append to the end.
        const existing = await workoutService.getWorkoutPlansForStudentAsCoach(user.id, studentId);
        const maxOrder = existing.reduce((max, p) => {
          const n = typeof p.order === "number" && Number.isFinite(p.order) ? p.order : -1;
          return Math.max(max, n);
        }, -1);
        setOrder(maxOrder + 1);
      } catch (e: any) {
        setError(e.message ?? "Failed to load user.");
      } finally {
        setInitializingUser(false);
      }
    };

    init();
  }, [user?.id, user?.role, studentId, params.groupId, studentName, router]);

  const resolvedGroupName = useMemo(() => {
    if (!selectedGroup) return null;
    return selectedGroup.name?.trim() || null;
  }, [selectedGroup]);

  const updateExercise = (key: string, patch: Partial<ExerciseDraft>) => {
    setExercises((prev) => {
      const next = prev.map((e) => (e._key === key ? { ...e, ...patch } : e));
      return next;
    });
  };

  const addExercise = () => {
    const base = workoutService.createEmptyExercise();
    const nextKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const next: ExerciseDraft = {
      _key: nextKey,
      ...base,
      coachNote: "",
    };
    setExercises((prev) => [...prev, next]);
    setLastAddedKey(nextKey);
    setExpandedKey(nextKey);
  };

  const addExerciseFromLibrary = (payload: { name: string }) => {
    const base = workoutService.createEmptyExercise();
    const nextKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const next: ExerciseDraft = {
      _key: nextKey,
      ...base,
      name: payload.name,
      coachNote: "",
    };
    setExercises((prev) => [...prev, next]);
    setLastAddedKey(nextKey);
    setExpandedKey(nextKey);
  };

  const handleSavePlan = async () => {
    if (!coachId || !studentId) {
      setError("Missing coach or student information.");
      return;
    }
    if (!selectedGroup) {
      setError("Select or create a training group first.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const name = planName.trim();
      if (!name) throw new Error("Workout name is required.");
      if (name.length > 50) throw new Error("Workout name must be at most 50 characters.");
      if (note.trim().length > 500) throw new Error("Coach notes must be at most 500 characters.");

      const durationTrim = estimatedMinutes.trim();
      const durationNum =
        durationTrim === "" ? undefined : Math.max(0, Math.floor(Number(durationTrim)));
      if (durationTrim !== "" && !Number.isFinite(Number(durationTrim))) {
        throw new Error("Estimated duration must be a number of minutes.");
      }

      const sanitizedExercises: Exercise[] = exercises
        .map((e) => {
          const rest = (e.rest ?? "").trim();
          const tempo = (e.tempo ?? "").trim();
          const rpe = e.rpe === null || e.rpe === undefined ? null : e.rpe;

          return {
            name: (e.name ?? "").trim(),
            sets: Number(e.sets ?? 0),
            reps: (e.reps ?? "").trim(),
            weight: e.weight,
            rest,
            tempo,
            rpe: rpe === null ? null : rpe,
            coachNote: (e.coachNote ?? "").trim() || undefined,
          };
        })
        .filter((e) => e.name.length > 0);

      if (sanitizedExercises.length === 0) {
        throw new Error("Add at least one exercise.");
      }

      for (const ex of sanitizedExercises) {
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

      await workoutService.createWorkoutPlan({
        coachId,
        studentId,
        groupId: selectedGroup.id,
        groupName: selectedGroup.name?.trim() || "Legacy Plan",
        name,
        exercises: sanitizedExercises,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        order,
        note: note.trim() || undefined,
        estimatedDurationMinutes: durationNum,
      });
      // Mark group as recently used.
      trainingGroupService.touchUpdatedAt(selectedGroup.id).catch(() => {});
      await Promise.all(
        sanitizedExercises.map((e) => exerciseTemplateService.upsertNameIfNeeded(e.name))
      );
      router.replace("/coach/dashboard");
    } catch (e: any) {
      setError(e.message ?? "Failed to save workout plan.");
    } finally {
      setLoading(false);
    }
  };

  if (initializingUser) {
    return (
      <ScreenLayout>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: Colors.bg,
          }}
        >
          <ActivityIndicator />
        </View>
      </ScreenLayout>
    );
  }

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
          // Ensures the list shifts for the keyboard so inputs don't get covered.
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: 140 }}
          ListHeaderComponent={
            <>
              {/* Header */}
              <View style={{ marginBottom: Spacing.md }}>
                <Text style={{ ...Typography.title, fontSize: 26, marginBottom: 6 }}>
                  Create Workout Plan
                </Text>
                <Text style={{ ...Typography.section, fontWeight: "900" }}>{studentName}</Text>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }}>
                  {resolvedGroupName ?? "Legacy Plan"}
                </Text>
              </View>

              {/* Workout info card */}
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
                      placeholder="e.g. 1"
                      placeholderTextColor={Colors.textMuted}
                      value={String(order)}
                      onChangeText={(t) => {
                        const cleaned = t.trim().replace(/[^0-9-]/g, "");
                        const n = Number(cleaned);
                        if (cleaned === "") {
                          setOrder(0);
                          return;
                        }
                        if (!Number.isFinite(n)) return;
                        setOrder(Math.max(0, Math.floor(n)));
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
                    <Text style={{ ...Typography.secondary, marginBottom: 6 }}>
                      Est. minutes
                    </Text>
                    <TextInput
                      placeholder="e.g. 60"
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

                <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Coach notes (optional)</Text>
                <TextInput
                  placeholder="Key cues, intent, constraints…"
                  placeholderTextColor={Colors.textMuted}
                  value={note}
                  onChangeText={(t) => setNote(t.slice(0, 500))}
                  multiline
                  style={{
                    borderWidth: 1,
                    borderColor: Colors.border,
                    padding: 12,
                    borderRadius: Radius.md,
                    marginBottom: Spacing.sm,
                    color: Colors.text,
                    backgroundColor: Colors.surface,
                    minHeight: 84,
                  }}
                />
              </View>

              {/* Exercises */}
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
                      // Only auto-focus on freshly added exercises, never on manual expand.
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

      {/* Sticky footer CTA */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: Spacing.md,
          paddingBottom: Spacing.md,
          backgroundColor: Colors.bg,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
        }}
      >
        {loading ? <ActivityIndicator /> : <PrimaryButton title="Save Workout Plan" onPress={handleSavePlan} />}
      </View>

      {coachId ? (
        <ExerciseLibraryModal
          visible={libraryOpen}
          coachId={coachId}
          onClose={() => setLibraryOpen(false)}
          onAddExercise={(p) => addExerciseFromLibrary({ name: p.name })}
        />
      ) : null}
    </ScreenLayout>
  );
}

