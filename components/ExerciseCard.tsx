import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { parseFloatInput } from "../utils/inputParsing";
import { Radius, Spacing } from "../theme/spacing";
import { Typography } from "../theme/typography";

export type ExerciseDraft = {
  _key: string;
  name: string;
  sets: number;
  reps: string;
  weight?: number;
  rest: string;
  tempo: string;
  rpe: number | null;
  coachNote?: string;
};

type Props = {
  value: ExerciseDraft;
  index: number;
  expanded: boolean;
  autoFocusName?: boolean;
  onToggleExpanded: () => void;
  onChange: (next: ExerciseDraft) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  dragHandleProps?: any;
};

const toSummary = (e: ExerciseDraft): string => {
  const n = (e.name ?? "").trim() || "New exercise";
  const sets = Math.max(0, Math.round(Number(e.sets) || 0));
  const reps = String(e.reps ?? "").trim();
  const w = e.weight != null && Number.isFinite(Number(e.weight)) ? `${Number(e.weight)}kg` : "";
  const mid = sets > 0 && reps ? `${sets} x ${reps}` : sets > 0 ? `${sets} sets` : reps ? reps : "";
  const parts = [n, mid, w].filter(Boolean);
  return parts.join(" • ");
};

export function ExerciseCard({
  value,
  expanded,
  autoFocusName,
  onToggleExpanded,
  onChange,
  onDuplicate,
  onDelete,
  dragHandleProps,
}: Props) {
  const nameRef = useRef<TextInput | null>(null);
  const [weightText, setWeightText] = useState<string>(
    value.weight == null ? "" : String(value.weight)
  );
  const [weightFocused, setWeightFocused] = useState(false);

  useEffect(() => {
    if (weightFocused) return;
    setWeightText(value.weight == null ? "" : String(value.weight));
  }, [value.weight, weightFocused]);

  const summary = useMemo(() => toSummary(value), [value]);

  const update = (patch: Partial<ExerciseDraft>) => onChange({ ...value, ...patch });

  const parseIntSafe = (t: string) => {
    const cleaned = t.trim().replace(/[^0-9-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : value.sets;
  };
  const parseFloatSafe = (t: string) => parseFloatInput(t) ?? value.weight ?? undefined;

  return (
    <View
      style={{
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: "hidden",
      }}
    >
      <Pressable
        onPress={onToggleExpanded}
        style={({ pressed }) => ({
          padding: Spacing.md,
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.sm,
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Drag to reorder"
          {...dragHandleProps}
          style={({ pressed }) => ({
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: Colors.surface,
            borderWidth: 1,
            borderColor: Colors.border,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name="reorder-three" size={18} color={Colors.textMuted} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={{ ...Typography.section, fontWeight: "900" }}>
            {expanded ? "Exercise" : summary}
          </Text>
          {expanded ? (
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>
              Tap to collapse
            </Text>
          ) : (
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>
              Tap to expand
            </Text>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Duplicate exercise"
          onPress={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          style={({ pressed }) => ({
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: Colors.surface,
            borderWidth: 1,
            borderColor: Colors.border,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name="copy-outline" size={16} color={Colors.text} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete exercise"
          onPress={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={({ pressed }) => ({
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: Colors.surface,
            borderWidth: 1,
            borderColor: Colors.border,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
        </Pressable>

        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={Colors.textMuted}
        />
      </Pressable>

      {expanded ? (
        <View style={{ padding: Spacing.md, paddingTop: 0 }}>
          <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Exercise Name</Text>
          <TextInput
            ref={(r) => { nameRef.current = r; }}
            autoFocus={autoFocusName === true}
            placeholder="Bench Press"
            placeholderTextColor={Colors.textMuted}
            value={value.name}
            onChangeText={(t) => update({ name: t })}
            autoCorrect={false}
            autoCapitalize="words"
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

          <View style={{ flexDirection: "row", gap: Spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Sets</Text>
              <TextInput
                keyboardType="number-pad"
                value={String(value.sets ?? "")}
                onChangeText={(t) => update({ sets: parseIntSafe(t) })}
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
              <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Reps</Text>
              <TextInput
                value={String(value.reps ?? "")}
                onChangeText={(t) => update({ reps: t })}
                placeholder="8-12"
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

          <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Weight (kg)</Text>
              <TextInput
                // iOS supports decimal-pad; Android may show a numeric keyboard with locale comma.
                keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                inputMode="decimal"
                value={weightText}
                onChangeText={(t) => {
                  setWeightText(t);
                  const trimmed = t.trim();
                  if (trimmed === "") {
                    update({ weight: undefined });
                    return;
                  }
                  const parsed = parseFloatSafe(trimmed);
                  // Only commit numeric values; keep draft text for intermediate states like "7."
                  if (parsed !== undefined) update({ weight: parsed });
                }}
                onFocus={() => setWeightFocused(true)}
                onBlur={() => {
                  setWeightFocused(false);
                  const trimmed = weightText.trim();
                  if (trimmed === "") {
                    setWeightText("");
                    update({ weight: undefined });
                    return;
                  }
                  const parsed = parseFloatSafe(trimmed);
                  if (parsed === undefined) return;
                  setWeightText(String(parsed));
                  update({ weight: parsed });
                }}
                placeholder="50"
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
            <View style={{ flex: 1 }}>
              <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Rest (sec)</Text>
              <TextInput
                keyboardType="number-pad"
                value={String(value.rest ?? "")}
                onChangeText={(t) => update({ rest: t })}
                placeholder="90"
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

          <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Tempo</Text>
              <TextInput
                value={String(value.tempo ?? "")}
                onChangeText={(t) => update({ tempo: t })}
                placeholder="3-1-1"
                placeholderTextColor={Colors.textMuted}
                maxLength={20}
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
              <Text style={{ ...Typography.secondary, marginBottom: 6 }}>RPE</Text>
              <TextInput
                keyboardType="decimal-pad"
                value={value.rpe == null ? "" : String(value.rpe)}
                onChangeText={(t) => {
                  const trimmed = t.trim();
                  const n = trimmed === "" ? null : Number(trimmed);
                  update({ rpe: Number.isFinite(n as any) ? (n as any) : null });
                }}
                placeholder="8"
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

          <View style={{ marginTop: Spacing.sm }}>
            <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Coach Note</Text>
            <TextInput
              value={value.coachNote ?? ""}
              onChangeText={(t) => update({ coachNote: t })}
              placeholder="Cues, intent, tempo reminders…"
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={500}
              style={{
                borderWidth: 1,
                borderColor: Colors.border,
                padding: 12,
                borderRadius: Radius.md,
                color: Colors.text,
                backgroundColor: Colors.surface,
                minHeight: 70,
              }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

