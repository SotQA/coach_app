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
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../theme/colors";
import { Radius, Spacing } from "../theme/spacing";
import { Typography } from "../theme/typography";
import {
  exerciseTemplateService,
  type ExerciseTemplate,
} from "../services/exerciseTemplateService";
import {
  BODY_PART_MAP,
  EQUIPMENT_MAP,
  cacheExerciseToFirestore,
  getBodyPartList,
  getByBodyPart,
  getEquipmentList,
  searchExercises,
  type ExerciseDBExercise,
  type ExercisePageResult,
} from "../services/exerciseDbService";
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

const BODY_PART_OPTIONS: { label: string; value: string | null }[] = [
  { label: "All", value: null },
  { label: "Chest", value: "Chest" },
  { label: "Back", value: "Back" },
  { label: "Legs", value: "Legs" },
  { label: "Shoulders", value: "Shoulders" },
  { label: "Arms", value: "Arms" },
  { label: "Core", value: "Core" },
  { label: "Cardio", value: "Cardio" },
  { label: "Mobility", value: "Mobility" },
];

const EQUIPMENT_OPTIONS: { label: string; value: string | null }[] = [
  { label: "All", value: null },
  { label: "Barbell", value: "Barbell" },
  { label: "Dumbbell", value: "Dumbbell" },
  { label: "Cable", value: "Cable" },
  { label: "Machine", value: "Machine" },
  { label: "Body Weight", value: "Body Weight" },
  { label: "Kettlebell", value: "Kettlebell" },
  { label: "Resistance Band", value: "Resistance Band" },
  { label: "EZ Bar", value: "EZ Bar" },
];

// Reverse maps: API UPPERCASE value → display label (built once at module level).
const API_TO_BODY_PART: Record<string, string> = {};
for (const [label, apiValues] of Object.entries(BODY_PART_MAP)) {
  for (const v of apiValues) {
    API_TO_BODY_PART[v] = label;
  }
}

const API_TO_EQUIPMENT: Record<string, string> = {};
for (const [label, apiValue] of Object.entries(EQUIPMENT_MAP)) {
  API_TO_EQUIPMENT[apiValue] = label;
}

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
  }) => void;
};

// ---------------------------------------------------------------------------
// ExerciseDB card sub-component
// ---------------------------------------------------------------------------

function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

type DBCardProps = {
  item: ExerciseDBExercise;
  adding: boolean;
  onAdd: () => void;
};

function ExerciseDBCard({ item, adding, onAdd }: DBCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const imageSource = item.imageUrls?.["360p"] ?? item.gifUrl ?? item.imageUrl ?? "";

  // Reset flags when the image source changes (list recycling).
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [imageSource]);

  return (
    <View
      style={{
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: Spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        padding: Spacing.sm,
        gap: Spacing.sm,
      }}
    >
      {/* Thumbnail — only rendered when a URL is available */}
      {imageSource ? (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: Radius.md,
            backgroundColor: Colors.surface,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {!imageLoaded && !imageError && (
            <ActivityIndicator size="small" color={Colors.textMuted} />
          )}
          {imageError ? (
            <Ionicons name="barbell-outline" size={28} color={Colors.textMuted} />
          ) : (
            <Image
              source={{ uri: imageSource }}
              style={{
                width: 64,
                height: 64,
                opacity: imageLoaded ? 1 : 0,
                position: imageLoaded ? "relative" : "absolute",
              }}
              contentFit="cover"
              onLoadEnd={() => setImageLoaded(true)}
              onError={() => {
                console.warn("[ExerciseDBCard] Image failed to load:", imageSource);
                setImageError(true);
              }}
            />
          )}
          {item.videoUrl ? (
            <View style={{ position: "absolute", top: 4, left: 4, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 4, padding: 2 }}>
              <Text style={{ color: "#fff", fontSize: 10 }}>▶</Text>
            </View>
          ) : null}
        </View>
      ) : null}

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
          {item.bodyPart ? (
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
                {toTitleCase(item.bodyPart)}
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

      {/* Add button */}
      <Pressable
        onPress={onAdd}
        disabled={adding}
        style={({ pressed }) => ({
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: Colors.primary,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed || adding ? 0.7 : 1,
          flexShrink: 0,
        })}
      >
        {adding ? (
          <ActivityIndicator size="small" color={Colors.onPrimary} />
        ) : (
          <Ionicons name="add" size={22} color={Colors.onPrimary} />
        )}
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
  const [dbResults, setDbResults] = useState<ExerciseDBExercise[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbLoadingMore, setDbLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [offlineBanner, setOfflineBanner] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [successIds, setSuccessIds] = useState<Set<string>>(new Set());
  // Dynamic filter chip lists — seeded with hardcoded fallbacks.
  const [bodyPartOptions, setBodyPartOptions] = useState<{ label: string; value: string | null }[]>(BODY_PART_OPTIONS);
  const [equipmentOptions, setEquipmentOptions] = useState<{ label: string; value: string | null }[]>(EQUIPMENT_OPTIONS);

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

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Fetch dynamic filter options from the API on first DB tab open.
  useEffect(() => {
    if (!visible || activeTab !== "db") return;
    Promise.all([getBodyPartList(), getEquipmentList()])
      .then(([rawBodyParts, rawEquipments]) => {
        // Body parts: map API values → display labels, deduplicate.
        if (rawBodyParts.length > 0) {
          const seen = new Set<string>();
          const opts: { label: string; value: string | null }[] = [{ label: "All", value: null }];
          for (const rawItem of rawBodyParts) {
            // Coerce to string — guards against API returning objects instead of strings.
            const raw = String(rawItem);
            const label: string = API_TO_BODY_PART[raw] ?? toTitleCase(raw.toLowerCase());
            if (!seen.has(label)) {
              seen.add(label);
              opts.push({ label, value: label });
            }
          }
          setBodyPartOptions(opts);
        }
        // Equipment: map API values → display labels, deduplicate.
        if (rawEquipments.length > 0) {
          const seen = new Set<string>();
          const opts: { label: string; value: string | null }[] = [{ label: "All", value: null }];
          for (const rawItem of rawEquipments) {
            // Coerce to string — guards against API returning objects instead of strings.
            const raw = String(rawItem);
            const label: string = API_TO_EQUIPMENT[raw] ?? toTitleCase(raw.toLowerCase());
            if (!seen.has(label)) {
              seen.add(label);
              opts.push({ label, value: label });
            }
          }
          setEquipmentOptions(opts);
        }
      })
      .catch(() => {
        // Silently fall back to hardcoded lists already in state.
      });
  }, [visible, activeTab]);

  // Debounce DB search query (400ms).
  useEffect(() => {
    const t = setTimeout(() => setDbDebounced(dbQuery), 400);
    return () => clearTimeout(t);
  }, [dbQuery]);

  // Debounce library search query (150ms).
  useEffect(() => {
    const t = setTimeout(() => setLibDebounced(libQuery), 150);
    return () => clearTimeout(t);
  }, [libQuery]);

  // Reset state on open.
  useEffect(() => {
    if (!visible) return;

    // Reset DB tab
    setDbQuery("");
    setDbDebounced("");
    setSelectedBodyPart(null);
    setSelectedEquipment(null);
    setOpenPicker(null);
    setDbResults([]);
    setDbLoading(false);
    setDbLoadingMore(false);
    setNextCursor(null);
    setHasNextPage(false);
    setOfflineBanner(false);
    setAddingId(null);
    setSuccessIds(new Set());

    // Reset Library tab
    setLibQuery("");
    setLibDebounced("");
    setLibCategory(null);
    setCreateName("");
    setCreateCategory("Chest");
    setCreateEquipment("");
    setCreating(false);

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

  // Search ExerciseDB on debounced query change.
  useEffect(() => {
    if (!visible || activeTab !== "db") return;
    const q = dbDebounced.trim();
    if (!q) {
      setDbResults([]);
      setOfflineBanner(false);
      setNextCursor(null);
      setHasNextPage(false);
      return;
    }
    let cancelled = false;
    setDbLoading(true);
    setOfflineBanner(false);
    setNextCursor(null);
    setHasNextPage(false);
    searchExercises(q)
      .then((result: ExercisePageResult) => {
        if (cancelled) return;
        setDbResults(result.exercises);
        setNextCursor(result.nextCursor);
        setHasNextPage(result.hasNextPage);
      })
      .catch(() => {
        if (cancelled) return;
        setOfflineBanner(true);
        setDbResults([]);
      })
      .finally(() => {
        if (!cancelled) setDbLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dbDebounced, visible, activeTab]);

  // Fetch by body part / equipment when filters change and no search query.
  useEffect(() => {
    if (!visible || activeTab !== "db") return;
    if (dbDebounced.trim()) return; // search query takes precedence
    // Both "All" — fetch a general list instead of showing nothing
    let cancelled = false;
    setDbLoading(true);
    setOfflineBanner(false);
    setNextCursor(null);
    setHasNextPage(false);
    getByBodyPart(selectedBodyPart ?? "", selectedEquipment ?? undefined)
      .then((result: ExercisePageResult) => {
        if (cancelled) return;
        setDbResults(result.exercises);
        setNextCursor(result.nextCursor);
        setHasNextPage(result.hasNextPage);
      })
      .catch(() => {
        if (cancelled) return;
        setOfflineBanner(true);
        setDbResults([]);
      })
      .finally(() => {
        if (!cancelled) setDbLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedBodyPart, selectedEquipment, dbDebounced, visible, activeTab]);

  // ---------------------------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------------------------

  const handleLoadMore = useCallback(async () => {
    if (!hasNextPage || dbLoadingMore || dbLoading || !nextCursor) return;
    setDbLoadingMore(true);
    try {
      const q = dbDebounced.trim();
      let result: ExercisePageResult;
      if (q) {
        result = await searchExercises(q, nextCursor);
      } else {
        result = await getByBodyPart(
          selectedBodyPart ?? "",
          selectedEquipment ?? undefined,
          nextCursor
        );
      }
      setDbResults((prev) => [...prev, ...result.exercises]);
      setNextCursor(result.nextCursor);
      setHasNextPage(result.hasNextPage);
    } catch (e) {
      console.warn("[ExerciseLibraryModal] loadMore error", e);
    } finally {
      setDbLoadingMore(false);
    }
  }, [hasNextPage, dbLoadingMore, dbLoading, nextCursor, dbDebounced, selectedBodyPart, selectedEquipment]);

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
  // Handlers
  // ---------------------------------------------------------------------------

  const handleAddFromDB = async (exercise: ExerciseDBExercise) => {
    if (addingId) return;
    setAddingId(exercise.id);
    try {
      // 1. Cache raw exercise to Firestore global collection.
      await cacheExerciseToFirestore(exercise);

      // 2. Map to CachedExercise shape and add to coach's library.
      const { mapBodyPartToCategory, mapEquipment } = await import(
        "../services/exerciseDbService"
      );
      const cached = {
        id: exercise.id,
        name: toTitleCase(exercise.name),
        category: mapBodyPartToCategory(exercise.bodyPart),
        equipment: mapEquipment(exercise.equipment),
        gifUrl: exercise.gifUrl,
        imageUrls: exercise.imageUrls,
        videoUrl: exercise.videoUrl || undefined,
        overview: exercise.overview || undefined,
        exerciseTips: exercise.exerciseTips.length ? exercise.exerciseTips : undefined,
        targetMuscle: exercise.target,
        secondaryMuscles: exercise.secondaryMuscles,
        instructions: exercise.instructions,
        source: "exerciseDB" as const,
      };
      await exerciseTemplateService.addFromExerciseDB(coachId, cached);

      // 3. Record usage.
      exerciseTemplateService
        .recordUsage({
          coachId,
          name: cached.name,
          category: cached.category,
          equipment: cached.equipment,
        })
        .catch(() => {});

      // 4. Add the exercise to the workout plan.
      onAddExercise({
        name: cached.name,
        category: cached.category,
        equipment: cached.equipment,
      });

      // 5. Show brief success state.
      setSuccessIds((prev) => new Set(prev).add(exercise.id));
      setTimeout(() => {
        setSuccessIds((prev) => {
          const next = new Set(prev);
          next.delete(exercise.id);
          return next;
        });
      }, 1500);

      onClose();
    } catch (e) {
      console.warn("[ExerciseLibraryModal] handleAddFromDB error", e);
    } finally {
      setAddingId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const pickerOptions = openPicker === "bodyPart" ? bodyPartOptions : equipmentOptions;
  const pickerTitle = openPicker === "bodyPart" ? "Body Part" : "Equipment";

  const isBodyPartActive = selectedBodyPart !== null;
  const isEquipmentActive = selectedEquipment !== null;
  const hasActiveFilter = isBodyPartActive || isEquipmentActive;
  const hasSearchQuery = dbDebounced.trim().length > 0;

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
            data={dbResults}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: Spacing.md, paddingBottom: 40 }}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.2}
            ListFooterComponent={
              dbLoadingMore ? (
                <View style={{ paddingVertical: Spacing.md, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={Colors.textMuted} />
                </View>
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
                    placeholder="Search ExerciseDB..."
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
                        BODY PART
                      </Text>
                      <Text
                        style={{
                          ...Typography.secondary,
                          fontWeight: "600",
                          color: isBodyPartActive ? Colors.primary : Colors.text,
                        }}
                        numberOfLines={1}
                      >
                        {selectedBodyPart ?? "All"}
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
                        {selectedEquipment ?? "All"}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-down"
                      size={14}
                      color={isEquipmentActive ? Colors.primary : Colors.textMuted}
                    />
                  </Pressable>
                </View>

                {/* Offline banner */}
                {offlineBanner ? (
                  <View
                    style={{
                      backgroundColor: Colors.surface,
                      borderRadius: Radius.md,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      padding: Spacing.sm,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: Spacing.xs,
                      marginBottom: Spacing.sm,
                    }}
                  >
                    <Ionicons
                      name="cloud-offline-outline"
                      size={16}
                      color={Colors.textMuted}
                    />
                    <Text
                      style={{ ...Typography.secondary, color: Colors.textMuted }}
                    >
                      Using cached exercises (offline)
                    </Text>
                  </View>
                ) : null}

                {/* Empty state prompt */}
                {!hasSearchQuery && !hasActiveFilter && !dbLoading ? (
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
                      Search for exercises or use the filters above
                    </Text>
                  </View>
                ) : null}

                {/* Loading */}
                {dbLoading ? (
                  <View style={{ paddingVertical: Spacing.lg }}>
                    <ActivityIndicator />
                  </View>
                ) : null}
              </View>
            }
            renderItem={({ item }) => (
              <ExerciseDBCard
                item={item}
                adding={addingId === item.id}
                onAdd={() => handleAddFromDB(item)}
              />
            )}
            ListEmptyComponent={
              !dbLoading && (hasSearchQuery || hasActiveFilter) ? (
                <View style={{ paddingVertical: Spacing.lg }}>
                  <Text
                    style={{
                      ...Typography.secondary,
                      color: Colors.textMuted,
                      textAlign: "center",
                    }}
                  >
                    No results found
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
              ) : null
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
            contentContainerStyle={{ padding: Spacing.md, paddingBottom: 40 }}
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
                              onAddExercise({
                                name: t.name,
                                category: t.category,
                                equipment: t.equipment,
                              });
                              exerciseTemplateService
                                .recordUsage({
                                  coachId,
                                  name: t.name,
                                  category: t.category,
                                  equipment: t.equipment,
                                })
                                .catch(() => {});
                              onClose();
                            }}
                            style={({ pressed }) => ({
                              padding: Spacing.md,
                              borderRadius: Radius.lg,
                              backgroundColor: Colors.card,
                              borderWidth: 1,
                              borderColor: Colors.border,
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
                  backgroundColor: Colors.card,
                  borderRadius: Radius.lg,
                  padding: Spacing.md,
                  borderWidth: 1,
                  borderColor: Colors.border,
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
                      onAddExercise({
                        name: item.name,
                        category: item.category,
                        equipment: item.equipment,
                      });
                      exerciseTemplateService
                        .recordUsage({
                          coachId,
                          name: item.name,
                          category: item.category,
                          equipment: item.equipment,
                        })
                        .catch(() => {});
                      onClose();
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: Radius.lg,
                      backgroundColor: Colors.primary,
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
                      + Add
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
