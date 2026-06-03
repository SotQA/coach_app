import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../theme/colors";
import { Radius, Spacing } from "../theme/spacing";
import { Typography } from "../theme/typography";
import {
  exerciseTemplateService,
  type ExerciseTemplate,
} from "../services/exerciseTemplateService";
import * as localExerciseService from "../services/localExerciseService";
import type { LocalExercise } from "../services/localExerciseService";
import { toMs } from "../utils/dateConvert";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LIBRARY_CATEGORIES = [
  "Chest",
  "Back",
  "Legs",
  "Shoulders",
  "Arms",
  "Core",
  "Glutes",
  "Cardio",
  "Mobility",
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = "db" | "library";
type Picker = "bodyPart" | "equipment";

type Props = {
  visible: boolean;
  coachId: string;
  onClose: () => void;
  onAddExercise: (payload: {
    name: string;
    category?: string;
    equipment?: string;
    exerciseDbId?: string;
  }) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Local Exercise card sub-component
// ---------------------------------------------------------------------------

type LocalCardProps = {
  item: LocalExercise;
  onAdd: () => void;
  isSelected?: boolean;
};

function LocalExerciseCard({ item, onAdd, isSelected = false }: LocalCardProps) {
  return (
    <View
      style={{
        backgroundColor: isSelected ? Colors.primaryGlow : Colors.card,
        borderRadius: Radius.lg,
        borderWidth: isSelected ? 2 : 1,
        borderColor: isSelected ? Colors.primary : Colors.border,
        marginBottom: Spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        padding: Spacing.sm,
        gap: Spacing.sm,
      }}
    >
      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text
          style={{ ...Typography.section, fontWeight: "900" }}
          numberOfLines={2}
        >
          {toTitleCase(item.name)}
        </Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 4,
            marginTop: 4,
          }}
        >
          {item.primaryMuscles[0] ? (
            <View
              style={{
                paddingVertical: 2,
                paddingHorizontal: 8,
                borderRadius: Radius.pill,
                backgroundColor: Colors.surface,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontSize: 11 }}>
                {toTitleCase(item.primaryMuscles[0])}
              </Text>
            </View>
          ) : null}
          {item.equipment ? (
            <View
              style={{
                paddingVertical: 2,
                paddingHorizontal: 8,
                borderRadius: Radius.pill,
                backgroundColor: Colors.surface,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <Text
                style={{ ...Typography.secondary, color: Colors.textMuted, fontSize: 11 }}
              >
                {toTitleCase(item.equipment)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Add / selected toggle button */}
      <Pressable
        onPress={onAdd}
        style={({ pressed }) => ({
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: isSelected ? Colors.success : Colors.primary,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.7 : 1,
          flexShrink: 0,
        })}
      >
        <Ionicons name={isSelected ? "checkmark" : "add"} size={22} color={Colors.onPrimary} />
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

export function ExerciseLibraryModal({
  visible,
  coachId,
  onClose,
  onAddExercise,
}: Props) {
  const insets = useSafeAreaInsets();

  // ---- Tab state ----
  const [activeTab, setActiveTab] = useState<Tab>("db");

  // ---- Exercise DB tab state ----
  const dbSearchRef = useRef<TextInput | null>(null);
  const [dbQuery, setDbQuery] = useState("");
  const [dbDebounced, setDbDebounced] = useState("");
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [openPicker, setOpenPicker] = useState<Picker | null>(null);
  const [displayLimit, setDisplayLimit] = useState(50);

  // ---- My Library tab state ----
  const librarySearchRef = useRef<TextInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [allTemplates, setAllTemplates] = useState<ExerciseTemplate[]>([]);
  const [libQuery, setLibQuery] = useState("");
  const [libCategory, setLibCategory] = useState<string | null>(null);
  const [libDebounced, setLibDebounced] = useState("");
  const [createName, setCreateName] = useState("");
  const [createCategory, setCreateCategory] = useState<string>("Chest");
  const [createEquipment, setCreateEquipment] = useState("");
  const [creating, setCreating] = useState(false);

  // ---- Multi-select pending state ----
  type PendingPayload = { name: string; category?: string; equipment?: string; exerciseDbId?: string };
  const [pendingMap, setPendingMap] = useState<Map<string, PendingPayload>>(new Map());

  const togglePending = useCallback((id: string, payload: PendingPayload) => {
    setPendingMap((prev) => {
      const next = new Map(prev);
      next.has(id) ? next.delete(id) : next.set(id, payload);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    pendingMap.forEach((payload) => onAddExercise(payload));
    onClose();
  }, [pendingMap, onAddExercise, onClose]);

  // ---------------------------------------------------------------------------
  // Local exercise filter options (derived synchronously from local JSON)
  // ---------------------------------------------------------------------------

  const muscleOptions = localExerciseService.getAllMuscleOptions();
  const equipmentOptions = localExerciseService.getAllEquipmentOptions();

  const musclePickerOptions: { label: string; value: string | null }[] = useMemo(
    () => muscleOptions.map(m =>
      m === "all" ? { label: "All", value: null } : { label: toTitleCase(m), value: m }
    ),
    // muscleOptions is stable (computed from static JSON)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const equipmentPickerOptions: { label: string; value: string | null }[] = useMemo(
    () => equipmentOptions.map(e =>
      e === "all" ? { label: "All", value: null } : { label: toTitleCase(e), value: e }
    ),
    // equipmentOptions is stable (computed from static JSON)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ---------------------------------------------------------------------------
  // Filtered local exercises
  // ---------------------------------------------------------------------------

  const filteredExercises = useMemo(
    () =>
      localExerciseService.filterExercises({
        query: dbDebounced,
        muscle: selectedBodyPart,
        equipment: selectedEquipment,
        lang: "en",
      }),
    [dbDebounced, selectedBodyPart, selectedEquipment]
  );

  const displayedExercises = filteredExercises.slice(0, displayLimit);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Debounce DB search query (700ms).
  useEffect(() => {
    const t = setTimeout(() => setDbDebounced(dbQuery), 700);
    return () => clearTimeout(t);
  }, [dbQuery]);

  // Debounce library search query (150ms).
  useEffect(() => {
    const t = setTimeout(() => setLibDebounced(libQuery), 150);
    return () => clearTimeout(t);
  }, [libQuery]);

  // Reset displayLimit when filters change.
  useEffect(() => {
    setDisplayLimit(50);
  }, [dbDebounced, selectedBodyPart, selectedEquipment]);

  // Reset state on open.
  useEffect(() => {
    if (!visible) return;

    // Reset DB tab
    setDbQuery("");
    setDbDebounced("");
    setSelectedBodyPart(null);
    setSelectedEquipment(null);
    setOpenPicker(null);
    setDisplayLimit(50);

    // Reset Library tab
    setLibQuery("");
    setLibDebounced("");
    setLibCategory(null);
    setCreateName("");
    setCreateCategory("Chest");
    setCreateEquipment("");
    setCreating(false);

    // Reset multi-select
    setPendingMap(new Map());

    setLoading(true);
    exerciseTemplateService
      .listForCoach(coachId, 600)
      .then((rows) => setAllTemplates(rows))
      .finally(() => setLoading(false));

    const focusTimer = setTimeout(() => {
      if (activeTab === "db") {
        dbSearchRef.current?.focus();
      } else {
        librarySearchRef.current?.focus();
      }
    }, 250);
    return () => clearTimeout(focusTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, coachId]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleAddLocal = useCallback((exercise: LocalExercise) => {
    togglePending(exercise.id, { name: exercise.name, exerciseDbId: exercise.id });
  }, [togglePending]);

  // ---------------------------------------------------------------------------
  // Computed (Library tab)
  // ---------------------------------------------------------------------------

  const sortedTemplates = useMemo(() => {
    const rows = allTemplates.slice();
    rows.sort((a, b) => {
      const aRecent = toMs(a.lastUsedAt);
      const bRecent = toMs(b.lastUsedAt);
      if (bRecent !== aRecent) return bRecent - aRecent;
      const aCount = a.usageCount ?? 0;
      const bCount = b.usageCount ?? 0;
      if (bCount !== aCount) return bCount - aCount;
      return (a.name ?? "").localeCompare(b.name ?? "", undefined, {
        sensitivity: "base",
      });
    });
    return rows;
  }, [allTemplates]);

  const filteredTemplates = useMemo(() => {
    const q = libDebounced.trim().toLowerCase();
    const cat = libCategory?.toLowerCase() ?? null;
    return sortedTemplates.filter((t) => {
      if (cat && String(t.category ?? "").toLowerCase() !== cat) return false;
      if (!q) return true;
      return String(t.name ?? "").toLowerCase().includes(q);
    });
  }, [sortedTemplates, libDebounced, libCategory]);

  const recentlyUsed = useMemo(
    () =>
      sortedTemplates.filter((t) => toMs(t.lastUsedAt) > 0).slice(0, 10),
    [sortedTemplates]
  );

  const canCreate = useMemo(() => {
    const n = exerciseTemplateService.normalizeName(createName);
    return n.length >= 2 && Boolean(createCategory) && !creating;
  }, [createName, createCategory, creating]);

  const showCreate =
    !loading && libDebounced.trim().length > 0 && filteredTemplates.length === 0;

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const pickerOptions = openPicker === "bodyPart" ? musclePickerOptions : equipmentPickerOptions;
  const pickerTitle = openPicker === "bodyPart" ? "Body Part" : "Equipment";

  const isBodyPartActive = selectedBodyPart !== null;
  const isEquipmentActive = selectedEquipment !== null;

  // Display labels for current filter values
  const bodyPartLabel = selectedBodyPart ? toTitleCase(selectedBodyPart) : "All";
  const equipmentLabel = selectedEquipment ? toTitleCase(selectedEquipment) : "All";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        {/* ---------------------------------------------------------------- */}
        {/* Sticky header                                                     */}
        {/* ---------------------------------------------------------------- */}
        <View
          style={{
            paddingTop: Math.max(insets.top, 12),
            paddingHorizontal: Spacing.md,
            paddingBottom: Spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: Colors.border,
            backgroundColor: Colors.bg,
          }}
        >
          {/* Title row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: Radius.lg,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: Colors.card,
                borderWidth: 1,
                borderColor: Colors.border,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Ionicons name="close" size={18} color={Colors.text} />
            </Pressable>
            <Text style={{ ...Typography.section, fontWeight: "900" }}>
              Exercise Library
            </Text>
            <View style={{ width: 40, height: 40 }} />
          </View>

          {/* Tab bar */}
          <View
            style={{
              flexDirection: "row",
              marginTop: Spacing.sm,
              backgroundColor: Colors.surface,
              borderRadius: Radius.lg,
              padding: 3,
              gap: 3,
            }}
          >
            {(["db", "library"] as Tab[]).map((tab) => {
              const active = activeTab === tab;
              const label = tab === "db" ? "Exercise DB" : "My Library";
              return (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: 9,
                    borderRadius: Radius.md,
                    alignItems: "center",
                    backgroundColor: active ? Colors.primary : "transparent",
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text
                    style={{
                      ...Typography.secondary,
                      fontWeight: "700",
                      color: active ? Colors.onPrimary : Colors.textMuted,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* Tab: Exercise DB                                                  */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === "db" ? (
          <FlatList
            data={displayedExercises}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: Spacing.md, paddingBottom: pendingMap.size > 0 ? 112 : 40 }}
            ListFooterComponent={
              displayLimit < filteredExercises.length ? (
                <Pressable
                  onPress={() => setDisplayLimit(n => n + 50)}
                  style={({ pressed }) => ({
                    margin: Spacing.md,
                    padding: Spacing.sm,
                    borderRadius: Radius.lg,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    backgroundColor: Colors.card,
                    alignItems: "center",
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={{ ...Typography.body, color: Colors.textMuted }}>
                    Load more ({filteredExercises.length - displayLimit} remaining)
                  </Text>
                </Pressable>
              ) : null
            }
            ListHeaderComponent={
              <View>
                {/* Search bar */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: Spacing.sm,
                    backgroundColor: Colors.card,
                    borderRadius: Radius.lg,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    paddingHorizontal: Spacing.sm,
                    paddingVertical: 12,
                    marginBottom: Spacing.sm,
                  }}
                >
                  <Ionicons
                    name="search"
                    size={18}
                    color={Colors.textMuted}
                  />
                  <TextInput
                    ref={(r) => {
                      dbSearchRef.current = r;
                    }}
                    value={dbQuery}
                    onChangeText={setDbQuery}
                    placeholder="Search exercises..."
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    style={{
                      flex: 1,
                      ...Typography.section,
                      fontWeight: "700",
                      paddingVertical: 0,
                    }}
                  />
                  {dbQuery.trim() ? (
                    <Pressable onPress={() => setDbQuery("")}>
                      <Ionicons
                        name="close-circle"
                        size={18}
                        color={Colors.textMuted}
                      />
                    </Pressable>
                  ) : null}
                </View>

                {/* Two-button filter bar */}
                <View
                  style={{
                    flexDirection: "row",
                    gap: Spacing.sm,
                    marginBottom: Spacing.sm,
                  }}
                >
                  {/* Body Part button */}
                  <Pressable
                    onPress={() => setOpenPicker("bodyPart")}
                    style={({ pressed }) => ({
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 10,
                      paddingHorizontal: Spacing.sm,
                      borderRadius: Radius.lg,
                      backgroundColor: Colors.card,
                      borderWidth: 1,
                      borderColor: isBodyPartActive ? Colors.primary : Colors.border,
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <View style={{ flex: 1, marginRight: 4 }}>
                      <Text style={{ ...Typography.micro, marginBottom: 2 }}>
                        MUSCLE
                      </Text>
                      <Text
                        style={{
                          ...Typography.secondary,
                          fontWeight: "600",
                          color: isBodyPartActive ? Colors.primary : Colors.text,
                        }}
                        numberOfLines={1}
                      >
                        {bodyPartLabel}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-down"
                      size={14}
                      color={isBodyPartActive ? Colors.primary : Colors.textMuted}
                    />
                  </Pressable>

                  {/* Equipment button */}
                  <Pressable
                    onPress={() => setOpenPicker("equipment")}
                    style={({ pressed }) => ({
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 10,
                      paddingHorizontal: Spacing.sm,
                      borderRadius: Radius.lg,
                      backgroundColor: Colors.card,
                      borderWidth: 1,
                      borderColor: isEquipmentActive ? Colors.primary : Colors.border,
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <View style={{ flex: 1, marginRight: 4 }}>
                      <Text style={{ ...Typography.micro, marginBottom: 2 }}>
                        EQUIPMENT
                      </Text>
                      <Text
                        style={{
                          ...Typography.secondary,
                          fontWeight: "600",
                          color: isEquipmentActive ? Colors.primary : Colors.text,
                        }}
                        numberOfLines={1}
                      >
                        {equipmentLabel}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-down"
                      size={14}
                      color={isEquipmentActive ? Colors.primary : Colors.textMuted}
                    />
                  </Pressable>
                </View>

                {/* Count */}
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.sm }}>
                  Showing {displayedExercises.length} of {filteredExercises.length}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <LocalExerciseCard
                item={item}
                onAdd={() => handleAddLocal(item)}
                isSelected={pendingMap.has(item.id)}
              />
            )}
            ListEmptyComponent={
              <View style={{ paddingVertical: Spacing.lg, alignItems: "center" }}>
                <Ionicons
                  name="barbell-outline"
                  size={32}
                  color={Colors.textMuted}
                />
                <Text
                  style={{
                    ...Typography.secondary,
                    color: Colors.textMuted,
                    textAlign: "center",
                    marginTop: Spacing.sm,
                  }}
                >
                  No exercises found
                </Text>
                <Pressable
                  onPress={() => {
                    setActiveTab("library");
                    setLibQuery(dbDebounced.trim());
                  }}
                  style={({ pressed }) => ({
                    marginTop: Spacing.sm,
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: Radius.lg,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    alignSelf: "center",
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={{ ...Typography.secondary, color: Colors.text }}>
                    Create custom exercise
                  </Text>
                </Pressable>
              </View>
            }
          />
        ) : null}

        {/* ---------------------------------------------------------------- */}
        {/* Tab: My Library                                                   */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === "library" ? (
          <FlatList
            data={filteredTemplates}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: Spacing.md, paddingBottom: pendingMap.size > 0 ? 112 : 40 }}
            ListHeaderComponent={
              loading ? (
                <View style={{ paddingVertical: Spacing.lg }}>
                  <ActivityIndicator />
                </View>
              ) : (
                <>
                  {/* Search */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: Spacing.sm,
                      backgroundColor: Colors.card,
                      borderRadius: Radius.lg,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      paddingHorizontal: Spacing.sm,
                      paddingVertical: 12,
                      marginBottom: Spacing.sm,
                    }}
                  >
                    <Ionicons name="search" size={18} color={Colors.textMuted} />
                    <TextInput
                      ref={(r) => {
                        librarySearchRef.current = r;
                      }}
                      value={libQuery}
                      onChangeText={setLibQuery}
                      placeholder="Search exercise..."
                      placeholderTextColor={Colors.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="search"
                      style={{
                        flex: 1,
                        ...Typography.section,
                        fontWeight: "700",
                        paddingVertical: 0,
                      }}
                    />
                    {libQuery.trim() ? (
                      <Pressable onPress={() => setLibQuery("")}>
                        <Ionicons
                          name="close-circle"
                          size={18}
                          color={Colors.textMuted}
                        />
                      </Pressable>
                    ) : null}
                  </View>

                  {/* Categories */}
                  <View
                    style={{
                      flexDirection: "row",
                      gap: Spacing.xs,
                      marginBottom: Spacing.sm,
                      flexWrap: "wrap",
                    }}
                  >
                    {LIBRARY_CATEGORIES.map((c) => {
                      const active = c === libCategory;
                      return (
                        <Pressable
                          key={c}
                          onPress={() => setLibCategory(active ? null : c)}
                          style={({ pressed }) => ({
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: Radius.pill,
                            backgroundColor: active
                              ? Colors.primary
                              : Colors.surface,
                            borderWidth: 1,
                            borderColor: active ? Colors.primary : Colors.border,
                            opacity: pressed ? 0.9 : 1,
                          })}
                        >
                          <Text
                            style={{
                              ...Typography.secondary,
                              color: active ? Colors.onPrimary : Colors.text,
                            }}
                          >
                            {c}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Recently used */}
                  {recentlyUsed.length > 0 &&
                  !libDebounced.trim() &&
                  !libCategory ? (
                    <View style={{ marginBottom: Spacing.md }}>
                      <Text
                        style={{
                          ...Typography.section,
                          fontWeight: "900",
                          marginBottom: Spacing.sm,
                        }}
                      >
                        Recently Used
                      </Text>
                      <View style={{ gap: Spacing.xs }}>
                        {recentlyUsed.slice(0, 8).map((t) => (
                          <Pressable
                            key={`recent-${t.id}`}
                            onPress={() => {
                              togglePending(t.id, {
                                name: t.name,
                                category: t.category,
                                equipment: t.equipment,
                              });
                            }}
                            style={({ pressed }) => ({
                              padding: Spacing.md,
                              borderRadius: Radius.lg,
                              backgroundColor: pendingMap.has(t.id) ? Colors.primaryGlow : Colors.card,
                              borderWidth: pendingMap.has(t.id) ? 2 : 1,
                              borderColor: pendingMap.has(t.id) ? Colors.primary : Colors.border,
                              opacity: pressed ? 0.92 : 1,
                            })}
                          >
                            <Text
                              style={{ ...Typography.section, fontWeight: "900" }}
                            >
                              {t.name}
                            </Text>
                            <Text
                              style={{
                                ...Typography.secondary,
                                color: Colors.textMuted,
                                marginTop: 4,
                              }}
                            >
                              {(t.category ?? "Custom") +
                                (t.equipment ? ` • ${t.equipment}` : "")}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {/* Create custom exercise form */}
                  {showCreate ? (
                    <View
                      style={{
                        backgroundColor: Colors.card,
                        borderRadius: Radius.lg,
                        padding: Spacing.md,
                        borderWidth: 1,
                        borderColor: Colors.border,
                        marginBottom: Spacing.md,
                      }}
                    >
                      <Text
                        style={{
                          ...Typography.section,
                          fontWeight: "900",
                          marginBottom: Spacing.sm,
                        }}
                      >
                        Create custom exercise
                      </Text>
                      <Text
                        style={{
                          ...Typography.secondary,
                          color: Colors.textMuted,
                          marginBottom: 6,
                        }}
                      >
                        Name
                      </Text>
                      <TextInput
                        value={createName}
                        onChangeText={setCreateName}
                        placeholder={exerciseTemplateService.normalizeName(
                          libDebounced
                        )}
                        placeholderTextColor={Colors.textMuted}
                        style={{
                          borderWidth: 1,
                          borderColor: Colors.border,
                          padding: 12,
                          borderRadius: Radius.md,
                          color: Colors.text,
                          backgroundColor: Colors.surface,
                          marginBottom: Spacing.sm,
                        }}
                      />
                      <Text
                        style={{
                          ...Typography.secondary,
                          color: Colors.textMuted,
                          marginBottom: 6,
                        }}
                      >
                        Category
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: Spacing.xs,
                          marginBottom: Spacing.sm,
                        }}
                      >
                        {LIBRARY_CATEGORIES.map((c) => {
                          const active = c === createCategory;
                          return (
                            <Pressable
                              key={`create-${c}`}
                              onPress={() => setCreateCategory(c)}
                              style={({ pressed }) => ({
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: Radius.pill,
                                backgroundColor: active
                                  ? Colors.primary
                                  : Colors.surface,
                                borderWidth: 1,
                                borderColor: active
                                  ? Colors.primary
                                  : Colors.border,
                                opacity: pressed ? 0.9 : 1,
                              })}
                            >
                              <Text
                                style={{
                                  ...Typography.secondary,
                                  color: active
                                    ? Colors.onPrimary
                                    : Colors.text,
                                }}
                              >
                                {c}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <Text
                        style={{
                          ...Typography.secondary,
                          color: Colors.textMuted,
                          marginBottom: 6,
                        }}
                      >
                        Equipment (optional)
                      </Text>
                      <TextInput
                        value={createEquipment}
                        onChangeText={setCreateEquipment}
                        placeholder="Barbell, Dumbbell, Machine..."
                        placeholderTextColor={Colors.textMuted}
                        style={{
                          borderWidth: 1,
                          borderColor: Colors.border,
                          padding: 12,
                          borderRadius: Radius.md,
                          color: Colors.text,
                          backgroundColor: Colors.surface,
                          marginBottom: Spacing.sm,
                        }}
                      />
                      <Pressable
                        onPress={async () => {
                          if (!canCreate) return;
                          setCreating(true);
                          try {
                            const created =
                              await exerciseTemplateService.createCustomTemplate(
                                {
                                  coachId,
                                  name: createName || libDebounced,
                                  category: createCategory,
                                  equipment: createEquipment || undefined,
                                }
                              );
                            onAddExercise({
                              name: created.name,
                              category: created.category,
                              equipment: created.equipment,
                            });
                            exerciseTemplateService
                              .recordUsage({
                                coachId,
                                name: created.name,
                                category: created.category,
                                equipment: created.equipment,
                              })
                              .catch(() => {});
                            onClose();
                          } finally {
                            setCreating(false);
                          }
                        }}
                        style={({ pressed }) => ({
                          paddingVertical: 14,
                          borderRadius: Radius.lg,
                          backgroundColor: canCreate
                            ? Colors.primary
                            : Colors.disabled,
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: pressed ? 0.92 : 1,
                        })}
                      >
                        {creating ? (
                          <ActivityIndicator color={Colors.onPrimary} />
                        ) : (
                          <Text
                            style={{
                              ...Typography.section,
                              fontWeight: "900",
                              color: Colors.onPrimary,
                            }}
                          >
                            + Create custom exercise
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  ) : null}
                </>
              )
            }
            renderItem={({ item }) => (
              <View
                style={{
                  backgroundColor: pendingMap.has(item.id) ? Colors.primaryGlow : Colors.card,
                  borderRadius: Radius.lg,
                  padding: Spacing.md,
                  borderWidth: pendingMap.has(item.id) ? 2 : 1,
                  borderColor: pendingMap.has(item.id) ? Colors.primary : Colors.border,
                  marginBottom: Spacing.sm,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flex: 1, paddingRight: Spacing.sm }}>
                    <Text style={{ ...Typography.section, fontWeight: "900" }}>
                      {item.name}
                    </Text>
                    <Text
                      style={{
                        ...Typography.secondary,
                        color: Colors.textMuted,
                        marginTop: 4,
                      }}
                    >
                      {(item.category ?? "Custom") +
                        (item.equipment ? ` • ${item.equipment}` : "")}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      togglePending(item.id, {
                        name: item.name,
                        category: item.category,
                        equipment: item.equipment,
                      });
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: Radius.lg,
                      backgroundColor: pendingMap.has(item.id) ? Colors.success : Colors.primary,
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <Text
                      style={{
                        ...Typography.section,
                        fontWeight: "900",
                        color: Colors.onPrimary,
                      }}
                    >
                      {pendingMap.has(item.id) ? "✓" : "+ Add"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
            ListEmptyComponent={
              loading ? null : showCreate ? null : (
                <View style={{ paddingVertical: Spacing.lg }}>
                  <Text
                    style={{
                      ...Typography.secondary,
                      color: Colors.textMuted,
                      textAlign: "center",
                    }}
                  >
                    No exercises found.
                  </Text>
                </View>
              )
            }
          />
        ) : null}

        {/* ---------------------------------------------------------------- */}
        {/* Multi-select confirm bar                                          */}
        {/* ---------------------------------------------------------------- */}
        {pendingMap.size > 0 ? (
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              paddingHorizontal: Spacing.md,
              paddingTop: Spacing.sm,
              paddingBottom: Math.max(insets.bottom, Spacing.md),
              backgroundColor: Colors.bg,
              borderTopWidth: 1,
              borderTopColor: Colors.border,
            }}
          >
            <Pressable
              onPress={handleConfirm}
              style={({ pressed }) => ({
                backgroundColor: Colors.primary,
                borderRadius: Radius.lg,
                paddingVertical: 16,
                alignItems: "center",
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <Text style={{ ...Typography.section, fontWeight: "900", color: Colors.onPrimary }}>
                {`Add ${pendingMap.size} exercise${pendingMap.size === 1 ? "" : "s"}`}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* ---------------------------------------------------------------- */}
        {/* Filter Picker bottom sheet                                        */}
        {/* ---------------------------------------------------------------- */}
        <Modal
          visible={openPicker !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setOpenPicker(null)}
        >
          <View style={{ flex: 1, justifyContent: "flex-end" }}>
            {/* Backdrop */}
            <Pressable
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0,0,0,0.6)",
              }}
              onPress={() => setOpenPicker(null)}
            />

            {/* Sheet */}
            <View
              style={{
                backgroundColor: Colors.card,
                borderTopLeftRadius: Radius.xl,
                borderTopRightRadius: Radius.xl,
                paddingBottom: Math.max(insets.bottom, Spacing.md),
                maxHeight: "65%",
              }}
            >
              {/* Sheet header */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: Spacing.md,
                  paddingVertical: Spacing.sm,
                  borderBottomWidth: 1,
                  borderBottomColor: Colors.border,
                }}
              >
                <Text style={{ ...Typography.section, fontWeight: "900" }}>
                  {pickerTitle}
                </Text>
                <Pressable
                  onPress={() => setOpenPicker(null)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Ionicons name="close" size={20} color={Colors.text} />
                </Pressable>
              </View>

              {/* Options list */}
              <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
                {pickerOptions.map((option) => {
                  const isSelected =
                    openPicker === "bodyPart"
                      ? selectedBodyPart === option.value
                      : selectedEquipment === option.value;
                  return (
                    <Pressable
                      key={option.label}
                      onPress={() => {
                        if (openPicker === "bodyPart") {
                          setSelectedBodyPart(option.value);
                        } else {
                          setSelectedEquipment(option.value);
                        }
                        setOpenPicker(null);
                      }}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingVertical: Spacing.sm,
                        paddingHorizontal: Spacing.md,
                        borderBottomWidth: 1,
                        borderBottomColor: Colors.border,
                        backgroundColor: isSelected
                          ? Colors.surfaceSubtle
                          : "transparent",
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <Text
                        style={{
                          ...Typography.body,
                          color: isSelected ? Colors.primary : Colors.text,
                          fontWeight: isSelected ? "700" : "400",
                        }}
                      >
                        {String(option.label)}
                      </Text>
                      {isSelected ? (
                        <Ionicons name="checkmark" size={18} color={Colors.primary} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}
