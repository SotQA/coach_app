import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { ExerciseInput } from "../../components/ExerciseInput";
import { PrimaryButton } from "../../components/PrimaryButton";
import { useAuth } from "../../context/AuthContext";
import { trainingGroupService } from "../../services/trainingGroupService";
import { workoutService } from "../../services/workoutService";
import { exerciseTemplateService } from "../../services/exerciseTemplateService";
import type { Exercise } from "../../types/Workout";
import type { TrainingGroup, TrainingGroupType } from "../../types/TrainingGroup";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { ScreenLayout } from "../../components/ScreenLayout";

// Screen for coaches to build a workout plan for a specific student.
// Uses ExerciseInput to keep exercise editing logic reusable.
export default function CreateWorkoutPlan() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    studentId?: string;
    studentName?: string;
  }>();

  const [studentName] = useState(params.studentName ?? "Student");
  const [studentId] = useState(params.studentId ?? "");
  const [step, setStep] = useState<1 | 2>(1);
  const [groups, setGroups] = useState<TrainingGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<TrainingGroup | null>(null);
  const [groupType, setGroupType] = useState<TrainingGroupType>("PPL");
  const [customGroupName, setCustomGroupName] = useState("");
  const [workoutsPerWeek, setWorkoutsPerWeek] = useState("4");
  const [planName, setPlanName] = useState("Workout Plan");
  const [orderInput, setOrderInput] = useState("1");
  const [note, setNote] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([
    workoutService.createEmptyExercise(),
  ]);
  const [loading, setLoading] = useState(false);
  const [initializingUser, setInitializingUser] = useState(true);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

        // Load training groups (latest first) for step 1.
        setGroupsLoading(true);
        try {
          const existingGroups = await trainingGroupService.getTrainingGroupsForStudent(user.id, studentId);
          setGroups(existingGroups);
          setSelectedGroup(existingGroups[0] ?? null);
        } finally {
          setGroupsLoading(false);
        }

        // Best-effort default ordering: append to the end.
        const existing = await workoutService.getWorkoutPlansForStudentAsCoach(user.id, studentId);
        const maxOrder = existing.reduce((max, p) => {
          const n = typeof p.order === "number" && Number.isFinite(p.order) ? p.order : -1;
          return Math.max(max, n);
        }, -1);
        setOrderInput(String(maxOrder + 1));
      } catch (e: any) {
        setError(e.message ?? "Failed to load user.");
      } finally {
        setInitializingUser(false);
      }
    };

    init();
  }, [user?.id, user?.role, studentId]);

  const resolvedGroupName = useMemo(() => {
    if (!selectedGroup) return null;
    return selectedGroup.name?.trim() || null;
  }, [selectedGroup]);

  const handleCreateGroup = async () => {
    if (!coachId || !studentId) {
      setError("Missing coach or student information.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const baseName = groupType === "Custom" ? customGroupName.trim() : String(groupType);
      const wpw = Number(workoutsPerWeek);
      const created = await trainingGroupService.createTrainingGroup({
        coachId,
        studentId,
        type: groupType,
        name: baseName,
        workoutsPerWeek: Number.isFinite(wpw) ? wpw : 4,
      });
      setGroups((prev) => [created, ...prev]);
      setSelectedGroup(created);
      setStep(2);
    } catch (e: any) {
      setError(e.message ?? "Failed to create training group.");
    } finally {
      setLoading(false);
    }
  };

  const updateExercise = (index: number, exercise: Exercise) => {
    setExercises((prev) => {
      const copy = [...prev];
      copy[index] = exercise;
      return copy;
    });
  };

  const addExercise = () => {
    setExercises((prev) => [...prev, workoutService.createEmptyExercise()]);
  };

  const handleSavePlan = async () => {
    if (!coachId || !studentId) {
      setError("Missing coach or student information.");
      return;
    }
    if (!selectedGroup) {
      setError("Select or create a training group first.");
      setStep(1);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const name = planName.trim() || `Workout Plan for ${studentName}`;
      const parsedOrder = Number(orderInput);
      const order = Number.isFinite(parsedOrder) ? parsedOrder : 0;

      const sanitizedExercises = exercises
        .map((e) => {
          const rest = (e.rest ?? "").trim();
          const tempo = (e.tempo ?? "").trim();
          const rpe = e.rpe === null || e.rpe === undefined ? null : e.rpe;

          return {
            ...e,
            name: (e.name ?? "").trim(),
            reps: (e.reps ?? "").trim(),
            rest,
            tempo,
            rpe: rpe === null ? null : rpe,
          };
        })
        .filter((e) => e.name.length > 0);

      for (const ex of sanitizedExercises) {
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
      <KeyboardAwareScrollView
        style={{ flex: 1, backgroundColor: Colors.bg }}
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        enableResetScrollToCoords={false}
        extraScrollHeight={24}
        extraHeight={0}
        keyboardOpeningTime={0}
      >
        <View
          style={{
            backgroundColor: Colors.card,
            borderRadius: Radius.md,
            padding: 20,
            borderWidth: 1,
            borderColor: Colors.border,
          }}
        >
          <Text
            style={{
              ...Typography.title,
              fontSize: 22,
              marginBottom: 4,
            }}
          >
            Create Workout Plan
          </Text>
          <Text style={{ ...Typography.secondary, marginBottom: Spacing.md }}>
            For: {studentName}
          </Text>

          <View style={{ flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                title="1) Training Group"
                onPress={() => setStep(1)}
                style={{ backgroundColor: step === 1 ? Colors.primary : Colors.border }}
                textStyle={{ fontWeight: "900" }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                title="2) Workout Plan"
                onPress={() => {
                  if (!selectedGroup) {
                    setError("Select or create a training group first.");
                    setStep(1);
                    return;
                  }
                  setStep(2);
                }}
                style={{ backgroundColor: step === 2 ? Colors.primary : Colors.border }}
                textStyle={{ fontWeight: "900" }}
              />
            </View>
          </View>

          {step === 1 ? (
            <>
              <Text style={{ ...Typography.section, marginBottom: Spacing.xs }}>Choose a training group</Text>
              {groupsLoading ? (
                <ActivityIndicator />
              ) : groups.length === 0 ? (
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.sm }}>
                  No training groups yet.
                </Text>
              ) : (
                <View style={{ gap: Spacing.xs, marginBottom: Spacing.sm }}>
                  {groups.slice(0, 6).map((g) => {
                    const selected = selectedGroup?.id === g.id;
                    return (
                      <Pressable
                        key={g.id}
                        onPress={() => setSelectedGroup(g)}
                        style={({ pressed }) => ({
                          paddingVertical: 12,
                          paddingHorizontal: Spacing.sm,
                          borderRadius: Radius.lg,
                          backgroundColor: selected ? Colors.surface : Colors.bg,
                          borderWidth: 1,
                          borderColor: selected ? Colors.primary : Colors.border,
                          opacity: pressed ? 0.9 : 1,
                        })}
                      >
                        <Text style={{ ...Typography.section, fontWeight: "800" }}>{g.name}</Text>
                        <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>
                          {String(g.type)} · {g.workoutsPerWeek} / week
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <View style={{ marginTop: Spacing.sm }}>
                <PrimaryButton
                  title={selectedGroup ? "Continue with selected group" : "Continue"}
                  onPress={() => {
                    if (!selectedGroup) {
                      setError("Select or create a training group.");
                      return;
                    }
                    setStep(2);
                  }}
                  style={{ backgroundColor: Colors.border }}
                />
              </View>

              <View style={{ marginTop: Spacing.lg }}>
                <Text style={{ ...Typography.section, marginBottom: Spacing.xs }}>Or create a new one</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.sm }}>
                  {trainingGroupService.presetTypes.map((t) => {
                    const active = t === groupType;
                    return (
                      <Pressable
                        key={t}
                        onPress={() => setGroupType(t)}
                        style={({ pressed }) => ({
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: Radius.pill,
                          backgroundColor: active ? Colors.primary : Colors.surface,
                          borderWidth: 1,
                          borderColor: active ? Colors.primary : Colors.border,
                          opacity: pressed ? 0.9 : 1,
                        })}
                      >
                        <Text style={{ ...Typography.secondary, color: active ? Colors.onPrimary : Colors.text }}>
                          {t}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {groupType === "Custom" ? (
                  <>
                    <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Custom name</Text>
                    <TextInput
                      placeholder="e.g. Hypertrophy Block A"
                      placeholderTextColor={Colors.textMuted}
                      value={customGroupName}
                      onChangeText={setCustomGroupName}
                      style={{
                        borderWidth: 1,
                        borderColor: Colors.border,
                        padding: 12,
                        borderRadius: Radius.sm,
                        marginBottom: Spacing.sm,
                        color: Colors.text,
                        backgroundColor: Colors.surface,
                      }}
                    />
                  </>
                ) : null}

                <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Workouts / week</Text>
                <TextInput
                  placeholder="e.g. 4"
                  placeholderTextColor={Colors.textMuted}
                  value={workoutsPerWeek}
                  onChangeText={setWorkoutsPerWeek}
                  keyboardType="number-pad"
                  style={{
                    borderWidth: 1,
                    borderColor: Colors.border,
                    padding: 12,
                    borderRadius: Radius.sm,
                    marginBottom: Spacing.sm,
                    color: Colors.text,
                    backgroundColor: Colors.surface,
                  }}
                />

                <PrimaryButton
                  title={loading ? "Creating…" : "Create group"}
                  onPress={handleCreateGroup}
                  disabled={loading}
                />
              </View>
            </>
          ) : (
            <>
              <View
                style={{
                  backgroundColor: Colors.surface,
                  borderRadius: Radius.lg,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  padding: Spacing.sm,
                  marginBottom: Spacing.md,
                }}
              >
                <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>Training Group</Text>
                <Text style={{ ...Typography.section, fontWeight: "800", marginTop: 2 }}>
                  {resolvedGroupName ?? "Legacy Plan"}
                </Text>
              </View>

          <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Plan Name</Text>
          <TextInput
            placeholder="e.g. Strength Block A"
            placeholderTextColor={Colors.textMuted}
            value={planName}
            onChangeText={setPlanName}
            style={{
              borderWidth: 1,
              borderColor: Colors.border,
              padding: 12,
              borderRadius: Radius.sm,
              marginBottom: Spacing.sm,
              color: Colors.text,
              backgroundColor: Colors.surface,
            }}
          />

          <Text style={{ ...Typography.secondary, marginBottom: 6, marginTop: Spacing.xs }}>
            Order
          </Text>
          <TextInput
            placeholder="e.g. 1"
            placeholderTextColor={Colors.textMuted}
            value={orderInput}
            onChangeText={setOrderInput}
            keyboardType="number-pad"
            style={{
              borderWidth: 1,
              borderColor: Colors.border,
              padding: 12,
              borderRadius: Radius.sm,
              marginBottom: Spacing.sm,
              color: Colors.text,
              backgroundColor: Colors.surface,
            }}
          />

          <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Coach Note (optional)</Text>
          <TextInput
            placeholder="Guidance or intent for this plan..."
            placeholderTextColor={Colors.textMuted}
            value={note}
            onChangeText={setNote}
            multiline
            style={{
              borderWidth: 1,
              borderColor: Colors.border,
              padding: 12,
              borderRadius: Radius.sm,
              marginBottom: Spacing.sm,
              color: Colors.text,
              backgroundColor: Colors.surface,
              minHeight: 60,
            }}
          />

          <FlatList
            data={exercises}
            scrollEnabled={false}
            keyExtractor={(_, index) => String(index)}
            renderItem={({ item, index }) => (
              <ExerciseInput
                value={item}
                onChange={(value) => updateExercise(index, value)}
              />
            )}
            ListFooterComponent={
              <View style={{ marginVertical: Spacing.xs }}>
                <PrimaryButton
                  title="Add Exercise"
                  onPress={addExercise}
                  style={{ backgroundColor: Colors.border }}
                />
              </View>
            }
          />

          <View style={{ marginTop: Spacing.md }}>
            {loading ? (
              <ActivityIndicator />
            ) : (
              <PrimaryButton title="Save Plan" onPress={handleSavePlan} />
            )}
            {error ? (
              <Text style={{ color: Colors.danger, marginTop: Spacing.xs }}>{error}</Text>
            ) : null}
          </View>
            </>
          )}
        </View>
      </KeyboardAwareScrollView>
    </ScreenLayout>
  );
}

