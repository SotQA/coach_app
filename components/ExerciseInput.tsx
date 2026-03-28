import { FC, useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Exercise } from "../types/Workout";
import { exerciseTemplateService } from "../services/exerciseTemplateService";
import { Colors } from "../theme/colors";
import { Radius, Spacing } from "../theme/spacing";
import { Typography } from "../theme/typography";

interface ExerciseInputProps {
  value: Exercise;
  onChange: (value: Exercise) => void;
  // Keep the simple layout for student set-logging.
  showAdvancedFields?: boolean;
  /** Load name suggestions from `exerciseTemplates` (coach plan builder). */
  enableNameSuggestions?: boolean;
}

// Small controlled input component used for both creating workout plans
// and logging a workout. Keeps form markup reusable.
export const ExerciseInput: FC<ExerciseInputProps> = ({
  value,
  onChange,
  showAdvancedFields = true,
  enableNameSuggestions = true,
}) => {
  // Keep a draft string for weight so typing "," (locale decimal separator)
  // doesn't instantly “disappear” due to parsing from the numeric value.
  const [weightText, setWeightText] = useState<string>(String(value.weight ?? 0));
  const [weightFocused, setWeightFocused] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!weightFocused) {
      setWeightText(String(value.weight ?? 0));
    }
  }, [value.weight, weightFocused]);

  useEffect(() => {
    if (!enableNameSuggestions) {
      setNameSuggestions([]);
      return;
    }
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    const name = (value.name ?? "").trim();
    if (name.length < 1) {
      setNameSuggestions([]);
      return;
    }
    suggestTimer.current = setTimeout(async () => {
      try {
        const rows = await exerciseTemplateService.searchByPrefix(name, 10);
        const lower = name.toLowerCase();
        const names = rows
          .map((r) => r.name)
          .filter((n) => n && n.toLowerCase() !== lower);
        setNameSuggestions(names);
      } catch {
        setNameSuggestions([]);
      }
    }, 200);
    return () => {
      if (suggestTimer.current) clearTimeout(suggestTimer.current);
    };
  }, [value.name, enableNameSuggestions]);

  const updateField = (field: keyof Exercise, fieldValue: string) => {
    // Firestore stores `reps` as a string. We keep it as-is for reps,
    // while still parsing numeric fields that should remain numbers.
    let parsedValue: any;

    if (field === "sets" || field === "weight") {
      // Normalize decimal separators and guard against transient invalid values
      // (e.g. users typing just "." or locale-specific commas) so we never
      // write `NaN` into state (which then renders as "NaN" in the input).
      const trimmed = fieldValue.trim();
      if (trimmed === "") {
        parsedValue = field === "sets" ? 0 : 0;
      } else if (field === "sets") {
        // Keep sets as an integer-ish numeric input.
        const cleaned = trimmed.replace(/[^0-9-]/g, "");
        const n = Number(cleaned);
        parsedValue = Number.isFinite(n) ? n : (value.sets ?? 0);
      } else {
        // Weight: allow floats with '.' (and normalize ',' -> '.').
        const normalized = trimmed.replace(/,/g, ".");
        const cleaned = normalized.replace(/[^0-9.]/g, "");
        const n = Number(cleaned);
        parsedValue = Number.isFinite(n) ? n : (value.weight ?? 0);
      }
    } else if (field === "rpe") {
      const trimmed = fieldValue.trim();
      parsedValue = trimmed === "" ? null : Number(trimmed);
      if (!Number.isFinite(parsedValue)) parsedValue = null;
    } else {
      // name, reps, rest, tempo
      parsedValue = fieldValue;
    }

    onChange({
      ...value,
      [field]: parsedValue,
    });
  };

  return (
    <View
      style={{
        marginVertical: Spacing.xs,
        padding: Spacing.sm,
        borderRadius: Radius.md,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
      }}
    >
      <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Exercise Name</Text>
      <TextInput
        placeholder="Bench Press"
        placeholderTextColor={Colors.textMuted}
        value={value.name}
        onChangeText={(text) => updateField("name", text)}
        autoCorrect={false}
        autoCapitalize="words"
        style={{
          borderWidth: 1,
          borderColor: Colors.border,
          padding: 12,
          borderRadius: Radius.sm,
          marginBottom: nameSuggestions.length ? 4 : Spacing.sm,
          color: Colors.text,
          backgroundColor: Colors.surface,
        }}
      />
      {enableNameSuggestions && nameSuggestions.length > 0 ? (
        <View style={{ marginBottom: Spacing.sm }}>
          {nameSuggestions.slice(0, 6).map((s) => (
            <Pressable
              key={s}
              onPress={() => onChange({ ...value, name: s })}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: Radius.sm,
                backgroundColor: pressed ? Colors.border : Colors.card,
                marginBottom: 4,
                borderWidth: 1,
                borderColor: Colors.border,
              })}
            >
              <Ionicons name="flash-outline" size={16} color={Colors.textMuted} />
              <Text style={{ ...Typography.secondary, color: Colors.text, flex: 1 }}>{s}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flex: 1, marginRight: 4 }}>
          <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Sets</Text>
          <TextInput
            keyboardType="numeric"
            value={String(value.sets)}
            onChangeText={(text) => updateField("sets", text)}
            style={{
              borderWidth: 1,
              borderColor: Colors.border,
              padding: 12,
              borderRadius: Radius.sm,
              color: Colors.text,
              backgroundColor: Colors.surface,
            }}
          />
        </View>

        <View style={{ flex: 1, marginHorizontal: 4 }}>
          <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Reps</Text>
          <TextInput
            // `reps` is stored in Firestore as a string, so allow full text input/paste.
            keyboardType="default"
            value={String(value.reps)}
            onChangeText={(text) => updateField("reps", text)}
            style={{
              borderWidth: 1,
              borderColor: Colors.border,
              padding: 12,
              borderRadius: Radius.sm,
              color: Colors.text,
              backgroundColor: Colors.surface,
            }}
          />
        </View>

        <View style={{ flex: 1, marginLeft: 4 }}>
          <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Weight (kg)</Text>
          <TextInput
            keyboardType="numeric"
            value={weightText}
            onChangeText={(text) => {
              setWeightText(text);
              updateField("weight", text);
            }}
            onFocus={() => setWeightFocused(true)}
            onBlur={() => {
              setWeightFocused(false);
              // Normalize commas to dots and drop trailing-only separators when possible.
              const normalized = weightText.trim().replace(/,/g, ".");
              const cleaned = normalized.replace(/[^0-9.]/g, "");
              const n = Number(cleaned);
              if (Number.isFinite(n)) {
                setWeightText(String(n));
              } else {
                setWeightText(String(value.weight ?? 0));
              }
            }}
            style={{
              borderWidth: 1,
              borderColor: Colors.border,
              padding: 12,
              borderRadius: Radius.sm,
              color: Colors.text,
              backgroundColor: Colors.surface,
            }}
          />
        </View>
      </View>

      {showAdvancedFields ? (
        <>
          <View style={{ flexDirection: "row", marginTop: Spacing.xs }}>
            <View style={{ flex: 1, marginRight: 4 }}>
              <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Rest (seconds)</Text>
              <TextInput
                keyboardType="numeric"
                value={value.rest ?? ""}
                onChangeText={(text) => updateField("rest", text)}
                placeholder=""
                style={{
                  borderWidth: 1,
                  borderColor: Colors.border,
                  padding: 12,
                  borderRadius: Radius.sm,
                  color: Colors.text,
                  backgroundColor: Colors.surface,
                }}
              />
            </View>

            <View style={{ flex: 1, marginLeft: 4 }}>
              <Text style={{ ...Typography.secondary, marginBottom: 6 }}>RPE (1-10)</Text>
              <TextInput
                keyboardType="numeric"
                value={value.rpe === null || value.rpe === undefined ? "" : String(value.rpe)}
                onChangeText={(text) => updateField("rpe", text)}
                placeholder=""
                style={{
                  borderWidth: 1,
                  borderColor: Colors.border,
                  padding: 12,
                  borderRadius: Radius.sm,
                  color: Colors.text,
                  backgroundColor: Colors.surface,
                }}
              />
            </View>
          </View>

          <View style={{ marginTop: Spacing.xs }}>
            <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Tempo (e.g. 3-1-1)</Text>
            <TextInput
              value={value.tempo ?? ""}
              onChangeText={(text) => updateField("tempo", text)}
              placeholder=""
              maxLength={20}
              style={{
                borderWidth: 1,
                borderColor: Colors.border,
                padding: 12,
                borderRadius: Radius.sm,
                color: Colors.text,
                backgroundColor: Colors.surface,
              }}
            />
          </View>
        </>
      ) : null}
    </View>
  );
};

