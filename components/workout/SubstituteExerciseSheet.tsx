import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useI18n } from "../../context/I18nContext";
import {
  filterExercises,
  getAllMuscleOptions,
  getExerciseById,
  getExerciseByName,
  getExerciseName,
  type LocalExercise,
} from "../../services/localExerciseService";
import { translateMuscle, translateEquipment } from "../../services/exerciseEnumTranslations";
import { BottomSheet } from "../BottomSheet";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";

const ALL_MUSCLES = "all";

export interface SubstituteExerciseSheetProps {
  visible: boolean;
  /** Display name of the exercise currently being substituted, for the sheet title. */
  currentExerciseName: string;
  currentExerciseDbId?: string;
  onCancel: () => void;
  onConfirm: (selected: LocalExercise) => void;
}

/**
 * Session-only substitution picker. Deliberately narrower than the full
 * ExerciseLibraryModal: no search, no equipment filter, no "My Library" tab,
 * no add-exercise action — scoped to the current exercise's muscle group
 * (plus an "All" pill), single select.
 */
export function SubstituteExerciseSheet({
  visible,
  currentExerciseName,
  currentExerciseDbId,
  onCancel,
  onConfirm,
}: SubstituteExerciseSheetProps) {
  const { t, locale } = useI18n();

  const currentLocalExercise = useMemo(() => {
    if (currentExerciseDbId) {
      const byId = getExerciseById(currentExerciseDbId);
      if (byId) return byId;
    }
    const byExactName = getExerciseByName(currentExerciseName);
    if (byExactName) return byExactName;
    // Plan exercises are often free-typed or created without a linked DB id (e.g. "Bench
    // Press"), which rarely matches the dataset's exact naming (e.g. "Barbell Bench Press").
    // Fall back to the same fuzzy start-with/contains matching the search box uses, just to
    // infer a muscle group for the default filter pills.
    if (currentExerciseName.trim().length >= 2) {
      const fuzzy = filterExercises({ query: currentExerciseName, lang: locale });
      if (fuzzy.length > 0) return fuzzy[0];
    }
    return null;
  }, [currentExerciseDbId, currentExerciseName, locale]);

  const musclePills = useMemo(() => {
    const primary = currentLocalExercise?.primaryMuscles?.[0] ?? null;
    const synergists = currentLocalExercise?.secondaryMuscles ?? [];
    if (!primary && synergists.length === 0) {
      // Couldn't infer a muscle group at all (e.g. "Overhead Press" has no dataset match) —
      // offer the full muscle list instead of leaving just a single, unfiltered "All" pill.
      return getAllMuscleOptions();
    }
    const seen = new Set<string>();
    const pills: string[] = [];
    if (primary) {
      pills.push(primary);
      seen.add(primary.toLowerCase());
    }
    for (const m of synergists) {
      if (!seen.has(m.toLowerCase())) {
        pills.push(m);
        seen.add(m.toLowerCase());
      }
    }
    pills.push(ALL_MUSCLES);
    return pills;
  }, [currentLocalExercise]);

  const [selectedMuscle, setSelectedMuscle] = useState<string>(musclePills[0] ?? ALL_MUSCLES);
  const [selected, setSelected] = useState<LocalExercise | null>(null);

  // Reset filter + selection whenever the sheet is (re)opened for a new exercise.
  useEffect(() => {
    if (visible) {
      setSelectedMuscle(musclePills[0] ?? ALL_MUSCLES);
      setSelected(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, currentExerciseDbId, currentExerciseName]);

  const results = useMemo(() => {
    const list = filterExercises({ muscle: selectedMuscle, lang: locale });
    return list.filter((e) => e.id !== currentLocalExercise?.id);
  }, [selectedMuscle, locale, currentLocalExercise]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onCancel}
      maxHeight="80%"
      header={
        <>
          <Text style={{ ...Typography.section, fontWeight: "900", paddingHorizontal: Spacing.md }}>
            {t("substituteSheetTitle", { name: currentExerciseName })}
          </Text>
          <Text
            style={{
              ...Typography.secondary,
              color: Colors.textMuted,
              paddingHorizontal: Spacing.md,
              marginTop: 4,
              marginBottom: Spacing.sm,
              fontSize: FontSizes.caption,
            }}
          >
            {t("substituteSheetSubtitle")}
          </Text>
        </>
      }
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm }}>
        {musclePills.map((m) => {
          const isOn = m === selectedMuscle;
          const label = m === ALL_MUSCLES ? t("muscleFilterAllOption") : translateMuscle(m, locale);
          return (
            <Pressable
              key={m}
              onPress={() => setSelectedMuscle(m)}
              style={({ pressed }) => ({
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: Radius.pill,
                backgroundColor: isOn ? Colors.primary : Colors.surface,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: FontSizes.caption, fontWeight: "600", color: isOn ? Colors.onPrimary : Colors.textMuted }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        style={{ flexGrow: 0 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={{ ...Typography.secondary, color: Colors.textMuted, padding: Spacing.md, textAlign: "center" }}>
            {t("noExercisesFound")}
          </Text>
        }
        renderItem={({ item }) => {
          const isSelected = selected?.id === item.id;
          const name = getExerciseName(item, locale);
          const tags = [translateMuscle(item.primaryMuscles?.[0] ?? "", locale), item.equipment ? translateEquipment(item.equipment, locale) : null]
            .filter(Boolean)
            .join(" · ");
          return (
            <Pressable
              onPress={() => setSelected(isSelected ? null : item)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: Spacing.sm,
                paddingVertical: 10,
                paddingHorizontal: Spacing.md,
                backgroundColor: isSelected ? Colors.subBlueTint : "transparent",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: Radius.sm,
                  backgroundColor: isSelected ? Colors.subBlue : Colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 15 }}>🏋️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...Typography.body, fontWeight: "600" }} numberOfLines={1}>
                  {name}
                </Text>
                {tags ? (
                  <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontSize: FontSizes.caption, marginTop: 1 }}>
                    {tags}
                  </Text>
                ) : null}
              </View>
              {isSelected ? (
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: Colors.subBlue,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: Colors.onPrimary, fontWeight: "800", fontSize: 12 }}>✓</Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />

      <View style={{ height: Spacing.sm }} />

      <Pressable
        disabled={!selected}
        onPress={() => selected && onConfirm(selected)}
        style={({ pressed }) => ({
          marginHorizontal: Spacing.md,
          marginBottom: Spacing.xs,
          backgroundColor: selected ? Colors.subBlue : Colors.disabled,
          borderRadius: Radius.lg,
          paddingVertical: 14,
          paddingHorizontal: Spacing.sm,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed && selected ? 0.9 : 1,
        })}
      >
        <Text
          style={{ ...Typography.section, fontWeight: "900", color: selected ? Colors.onPrimary : Colors.textMuted, textAlign: "center" }}
        >
          {selected ? t("substituteConfirmButton", { name: getExerciseName(selected, locale) }) : t("substituteConfirmButtonEmpty")}
        </Text>
      </Pressable>

      <Pressable
        onPress={onCancel}
        style={({ pressed }) => ({
          marginHorizontal: Spacing.md,
          backgroundColor: Colors.surface,
          borderRadius: Radius.lg,
          paddingVertical: 12,
          alignItems: "center",
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontWeight: "600" }}>{t("cancel")}</Text>
      </Pressable>
    </BottomSheet>
  );
}
