import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../theme/colors";
import { Radius, Spacing } from "../theme/spacing";
import { Typography } from "../theme/typography";
import { exerciseTemplateService, type ExerciseTemplate } from "../services/exerciseTemplateService";
import { logger } from "../utils/logger";
import { toMs } from "../utils/dateConvert";

const CATEGORIES = [
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

type Props = {
  visible: boolean;
  coachId: string;
  onClose: () => void;
  onAddExercise: (payload: { name: string; category?: string; equipment?: string }) => void;
};

export function ExerciseLibraryModal({ visible, coachId, onClose, onAddExercise }: Props) {
  const insets = useSafeAreaInsets();
  const searchRef = useRef<TextInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [allTemplates, setAllTemplates] = useState<ExerciseTemplate[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const [createName, setCreateName] = useState("");
  const [createCategory, setCreateCategory] = useState<string>("Chest");
  const [createEquipment, setCreateEquipment] = useState("");
  const [creating, setCreating] = useState(false);

  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 150);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!visible) return;
    setQuery("");
    setCategory(null);
    setCreateName("");
    setCreateCategory("Chest");
    setCreateEquipment("");
    setCreating(false);
    setLoading(true);
    exerciseTemplateService
      .listForCoach(coachId, 600)
      .then((rows) => setAllTemplates(rows))
      .finally(() => setLoading(false));

    // Auto-focus search.
    const focusTimer = setTimeout(() => searchRef.current?.focus(), 250);
    return () => clearTimeout(focusTimer);
  }, [visible, coachId]);

  const sortedTemplates = useMemo(() => {
    const rows = allTemplates.slice();
    rows.sort((a, b) => {
      const aRecent = toMs(a.lastUsedAt);
      const bRecent = toMs(b.lastUsedAt);
      if (bRecent !== aRecent) return bRecent - aRecent;
      const aCount = a.usageCount ?? 0;
      const bCount = b.usageCount ?? 0;
      if (bCount !== aCount) return bCount - aCount;
      return (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" });
    });
    return rows;
  }, [allTemplates]);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    const cat = category?.toLowerCase() ?? null;
    return sortedTemplates.filter((t) => {
      if (cat && String(t.category ?? "").toLowerCase() !== cat) return false;
      if (!q) return true;
      return String(t.name ?? "").toLowerCase().includes(q);
    });
  }, [sortedTemplates, debounced, category]);

  const recentlyUsed = useMemo(() => sortedTemplates.filter((t) => toMs(t.lastUsedAt) > 0).slice(0, 10), [sortedTemplates]);

  const canCreate = useMemo(() => {
    const n = exerciseTemplateService.normalizeName(createName);
    return n.length >= 2 && Boolean(createCategory) && !creating;
  }, [createName, createCategory, creating]);

  const showCreate =
    !loading &&
    debounced.trim().length > 0 &&
    filtered.length === 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        {/* Header */}
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
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
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
            <Text style={{ ...Typography.section, fontWeight: "900" }}>Exercise Library</Text>
            <View style={{ width: 40, height: 40 }} />
          </View>

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
              marginTop: Spacing.sm,
            }}
          >
            <Ionicons name="search" size={18} color={Colors.textMuted} />
            <TextInput
              ref={(r) => { searchRef.current = r; }}
              value={query}
              onChangeText={setQuery}
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
            {query.trim() ? (
              <Pressable onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {/* Categories */}
          <View style={{ flexDirection: "row", gap: Spacing.xs, marginTop: Spacing.sm, flexWrap: "wrap" }}>
            {CATEGORIES.map((c) => {
              const active = c === category;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategory(active ? null : c)}
                  style={({ pressed }) => ({
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: Radius.pill,
                    backgroundColor: active ? Colors.primary : Colors.surface,
                    borderWidth: 1,
                    borderColor: active ? Colors.primary : Colors.border,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={{ ...Typography.secondary, color: active ? Colors.onPrimary : Colors.text }}>
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <FlatList
          data={filtered}
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
                {/* Recently used */}
                {recentlyUsed.length > 0 && !debounced.trim() && !category ? (
                  <View style={{ marginBottom: Spacing.md }}>
                    <Text style={{ ...Typography.section, fontWeight: "900", marginBottom: Spacing.sm }}>
                      Recently Used
                    </Text>
                    <View style={{ gap: Spacing.xs }}>
                      {recentlyUsed.slice(0, 8).map((t) => (
                        <Pressable
                          key={`recent-${t.id}`}
                          onPress={() => {
                            onAddExercise({ name: t.name, category: t.category, equipment: t.equipment });
                            exerciseTemplateService.recordUsage({
                              coachId,
                              name: t.name,
                              category: t.category,
                              equipment: t.equipment,
                            }).catch(() => {});
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
                          <Text style={{ ...Typography.section, fontWeight: "900" }}>{t.name}</Text>
                          <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }}>
                            {(t.category ?? "Custom") + (t.equipment ? ` • ${t.equipment}` : "")}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}

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
                    <Text style={{ ...Typography.section, fontWeight: "900", marginBottom: Spacing.sm }}>
                      Create custom exercise
                    </Text>
                    <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: 6 }}>
                      Name
                    </Text>
                    <TextInput
                      value={createName}
                      onChangeText={setCreateName}
                      placeholder={exerciseTemplateService.normalizeName(debounced)}
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
                    <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: 6 }}>
                      Category
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.sm }}>
                      {CATEGORIES.map((c) => {
                        const active = c === createCategory;
                        return (
                          <Pressable
                            key={`create-${c}`}
                            onPress={() => setCreateCategory(c)}
                            style={({ pressed }) => ({
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              borderRadius: Radius.pill,
                              backgroundColor: active ? Colors.primary : Colors.surface,
                              borderWidth: 1,
                              borderColor: active ? Colors.primary : Colors.border,
                              opacity: pressed ? 0.9 : 1,
                            })}
                          >
                            <Text style={{ ...Typography.secondary, color: active ? Colors.onPrimary : Colors.text }}>
                              {c}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: 6 }}>
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
                          const created = await exerciseTemplateService.createCustomTemplate({
                            coachId,
                            name: createName || debounced,
                            category: createCategory,
                            equipment: createEquipment || undefined,
                          });
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
                        backgroundColor: canCreate ? Colors.primary : Colors.disabled,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.92 : 1,
                      })}
                    >
                      {creating ? (
                        <ActivityIndicator color={Colors.onPrimary} />
                      ) : (
                        <Text style={{ ...Typography.section, fontWeight: "900", color: Colors.onPrimary }}>
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
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flex: 1, paddingRight: Spacing.sm }}>
                  <Text style={{ ...Typography.section, fontWeight: "900" }}>{item.name}</Text>
                  <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }}>
                    {(item.category ?? "Custom") + (item.equipment ? ` • ${item.equipment}` : "")}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    onAddExercise({ name: item.name, category: item.category, equipment: item.equipment });
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
                  <Text style={{ ...Typography.section, fontWeight: "900", color: Colors.onPrimary }}>+ Add</Text>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={
            loading ? null : showCreate ? null : (
              <View style={{ paddingVertical: Spacing.lg }}>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, textAlign: "center" }}>
                  No exercises found.
                </Text>
              </View>
            )
          }
        />
      </View>
    </Modal>
  );
}

