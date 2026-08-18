import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { ExerciseCard, type ExerciseDraft } from "../../components/ExerciseCard";
import { ExerciseLibraryModal } from "../../components/ExerciseLibraryModal";
import { ExerciseRemoveConfirmRow } from "../../components/workout/ExerciseRemoveConfirmRow";
import { ConfirmPopup } from "../../components/ConfirmPopup";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenLayout } from "../../components/ScreenLayout";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { useToast } from "../../context/ToastContext";
import { workoutService } from "../../services/workoutService";
import { exerciseTemplateService } from "../../services/exerciseTemplateService";
import type { Exercise } from "../../types/Workout";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";
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

export default function AthleteEditPlan() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ workoutPlanId?: string }>();
  const workoutPlanId = useMemo(() => String(params.workoutPlanId ?? "").trim(), [params]);

  const [planName, setPlanName] = useState("");
  const [note, setNote] = useState("");
  const [order, setOrder] = useState(0);
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [exercises, setExercises] = useState<ExerciseDraft[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [lastAddedKey, setLastAddedKey] = useState<string | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const initialSnapshotRef = useRef<string | null>(null);
  const blockedActionRef = useRef<unknown>(null);

  useEffect(() => {
    const load = async () => {
      logger.log("[athlete/editPlan] load start", { workoutPlanId });
      setLoading(true);
      try {
        setError(null);

        if (!workoutPlanId) {
          setError(t("missingWorkoutPlanIdError"));
          return;
        }
        if (!user) {
          setError(t("goToLogin"));
          return;
        }

        const plan = await workoutService.getWorkoutPlanById(workoutPlanId);
        if (!plan) {
          setError(t("workoutPlanNotFoundError"));
          return;
        }
        if (plan.studentId !== user.id) {
          setError(t("noAccessToWorkoutPlanError"));
          return;
        }

        const name = plan.name ?? t("workoutPlanFallbackName");
        const noteVal = plan.note?.trim() ?? "";
        const orderVal = typeof plan.order === "number" && Number.isFinite(plan.order) ? plan.order : 0;
        const estVal = plan.estimatedDurationMinutes != null ? String(plan.estimatedDurationMinutes) : "";
        const initial =
          Array.isArray(plan.exercises) && plan.exercises.length ? plan.exercises : [workoutService.createEmptyExercise()];
        const initialDrafts = initial.map(toDraft);

        setPlanName(name);
        setNote(noteVal);
        setOrder(orderVal);
        setEstimatedMinutes(estVal);
        setExercises(initialDrafts);
        initialSnapshotRef.current = JSON.stringify({ name, noteVal, orderVal, estVal, exercises: initialDrafts });
      } catch (e: any) {
        console.error("[athlete/editPlan] load error", e);
        setError(e.message ?? t("failedToLoadWorkoutPlanError"));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [workoutPlanId, user?.id, t]);

  const hasUnsavedChanges = useMemo(() => {
    if (initialSnapshotRef.current === null) return false;
    const current = JSON.stringify({ name: planName, noteVal: note, orderVal: order, estVal: estimatedMinutes, exercises });
    return current !== initialSnapshotRef.current;
  }, [planName, note, order, estimatedMinutes, exercises]);

  // `usePreventRemove` reads `hasUnsavedChanges` from the last completed
  // render — mutating `initialSnapshotRef` right before `router.back()` in
  // handleSave doesn't force a re-render in time, so the guard would still
  // see the stale "unsaved" value and block a just-successful save. Checking
  // this ref directly inside the callback (a plain mutable read, not
  // memoized) sidesteps the render-timing race entirely.
  const justSavedRef = useRef(false);

  usePreventRemove(hasUnsavedChanges, (event) => {
    if (justSavedRef.current) {
      navigation.dispatch(event.data.action as never);
      return;
    }
    blockedActionRef.current = event.data.action;
    setShowDiscardConfirm(true);
  });

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
    if (!user || !workoutPlanId) return;
    setSaving(true);
    setError(null);
    try {
      const trimmedName = planName.trim();
      if (!trimmedName) throw new Error(t("workoutNameRequiredError"));
      if (trimmedName.length > 50) throw new Error(t("workoutNameMaxLenError"));
      if (note.trim().length > 500) throw new Error(t("notesMaxLenError"));

      const durationTrim = estimatedMinutes.trim();
      if (durationTrim !== "" && !Number.isFinite(Number(durationTrim))) {
        throw new Error(t("estDurationMustBeNumberError"));
      }
      const durationNum = durationTrim === "" ? undefined : Math.max(0, Math.floor(Number(durationTrim)));

      const normalizedExercises: Exercise[] = exercises
        .map((e) => ({
          id: e._key,
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

      if (normalizedExercises.length === 0) throw new Error(t("addAtLeastOneExerciseError"));

      for (const ex of normalizedExercises) {
        if (!Number.isFinite(ex.sets) || ex.sets <= 0) throw new Error(t("setsMustBePositiveError", { name: ex.name }));
        if (ex.rpe !== null && (!Number.isFinite(ex.rpe) || ex.rpe < 1 || ex.rpe > 10)) {
          throw new Error(t("rpeRangeError", { name: ex.name }));
        }
      }

      await workoutService.updateWorkoutPlan(workoutPlanId, user.id, {
        name: trimmedName,
        exercises: normalizedExercises,
        note: note.trim(),
        order,
        estimatedDurationMinutes: durationNum,
      });

      await Promise.all(normalizedExercises.map((e) => exerciseTemplateService.upsertNameIfNeeded(e.name)));

      initialSnapshotRef.current = null;
      justSavedRef.current = true;
      showToast(t("workoutUpdatedToast"));
      router.back();
    } catch (e: any) {
      setError(e.message ?? t("failedToSaveWorkoutPlanError"));
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
                <Text style={{ ...Typography.title, fontSize: FontSizes.h2, marginBottom: 6 }}>{t("editWorkoutTitle")}</Text>
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
                <Text style={{ ...Typography.secondary, marginBottom: 6 }}>{t("workoutNameLabel")}</Text>
                <TextInput
                  value={planName}
                  onChangeText={(text) => setPlanName(text.slice(0, 50))}
                  placeholder={t("workoutNamePlaceholder")}
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

                <View style={{ flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...Typography.secondary, marginBottom: 6 }}>{t("orderLabel")}</Text>
                    <TextInput
                      value={String(order)}
                      onChangeText={(text) => {
                        const n = Number(text.trim().replace(/[^0-9]/g, ""));
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
                    <Text style={{ ...Typography.secondary, marginBottom: 6 }}>{t("estMinutesLabel")}</Text>
                    <TextInput
                      value={estimatedMinutes}
                      onChangeText={(text) => setEstimatedMinutes(text.replace(/[^0-9]/g, ""))}
                      keyboardType="number-pad"
                      placeholder="60"
                      placeholderTextColor={Colors.textMuted}
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

                <Text style={{ ...Typography.secondary, marginBottom: 6 }}>{t("notesOptionalLabel")}</Text>
                <TextInput
                  value={note}
                  onChangeText={(text) => setNote(text.slice(0, 500))}
                  placeholder={t("notesPlaceholder")}
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

              <View style={{ marginBottom: Spacing.sm }}>
                <Text style={{ ...Typography.section, fontWeight: "900", marginBottom: Spacing.sm }}>
                  {t(exercises.length === 1 ? "exerciseCountDragToReorder_one" : "exerciseCountDragToReorder_other", {
                    count: exercises.length,
                  })}
                </Text>
                <PrimaryButton
                  title={t("addButtonShort")}
                  onPress={() => setLibraryOpen(true)}
                  style={{ width: "auto", alignSelf: "flex-end", paddingHorizontal: Spacing.md }}
                />
              </View>
            </>
          }
          ListFooterComponent={
            error ? <Text style={{ color: Colors.danger, marginTop: Spacing.sm, textAlign: "center" }}>{error}</Text> : null
          }
          renderItem={({ item, drag, isActive, getIndex }: RenderItemParams<ExerciseDraft>) => {
            if (item._key === confirmDeleteKey) {
              return (
                <View style={{ marginBottom: Spacing.sm }}>
                  <ExerciseRemoveConfirmRow
                    exerciseName={(item.name ?? "").trim() || t("newExerciseFallback")}
                    onKeep={() => setConfirmDeleteKey(null)}
                    onRemove={() => {
                      setExercises((prev) => prev.filter((p) => p._key !== item._key));
                      setExpandedKey((prev) => (prev === item._key ? null : prev));
                      setLastAddedKey((prev) => (prev === item._key ? null : prev));
                      setConfirmDeleteKey(null);
                    }}
                  />
                </View>
              );
            }
            const dimmed = confirmDeleteKey !== null;
            return (
              <View style={{ marginBottom: Spacing.sm, opacity: dimmed ? 0.35 : isActive ? 0.9 : 1 }} pointerEvents={dimmed ? "none" : "auto"}>
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
                  onDelete={() => setConfirmDeleteKey(item._key)}
                  dragHandleProps={{
                    onLongPress: () => {
                      // Starting a drag on an expanded card (tall form of
                      // inputs) races the collapse against the drag gesture's
                      // own layout measurement — the row's height changes out
                      // from under it mid-drag, causing the list to jump and
                      // the drag to break. So this press only collapses the
                      // card; the next long-press (now on the compact row)
                      // actually starts the drag.
                      if (expandedKey === item._key) {
                        setExpandedKey(null);
                        return;
                      }
                      drag();
                    },
                  }}
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
          paddingBottom: Math.max(insets.bottom, Spacing.md),
          backgroundColor: Colors.bg,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          opacity: confirmDeleteKey !== null ? 0.35 : 1,
        }}
        pointerEvents={confirmDeleteKey !== null ? "none" : "auto"}
      >
        {saving ? <ActivityIndicator /> : <PrimaryButton title={t("saveChanges")} onPress={handleSave} />}
      </View>

      {user ? (
        <ExerciseLibraryModal
          visible={libraryOpen}
          coachId={user.id}
          onClose={() => setLibraryOpen(false)}
          onAddExercise={(p) => addExerciseFromLibrary({ name: p.name, exerciseDbId: p.exerciseDbId })}
        />
      ) : null}

      <ConfirmPopup
        visible={showDiscardConfirm}
        icon="⚠️"
        title={t("discardChangesTitle")}
        body={t("discardChangesBody")}
        cancelLabel={t("keepEditingAction")}
        confirmLabel={t("discardAction")}
        confirmTone="danger"
        onCancel={() => setShowDiscardConfirm(false)}
        onConfirm={() => {
          setShowDiscardConfirm(false);
          initialSnapshotRef.current = null;
          if (blockedActionRef.current) {
            navigation.dispatch(blockedActionRef.current as never);
          }
        }}
      />
    </ScreenLayout>
  );
}
