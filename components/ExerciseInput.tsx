import { FC } from "react";
import { View, Text, TextInput } from "react-native";
import type { Exercise } from "../types/Workout";
import { Colors } from "../theme/colors";
import { Radius, Spacing } from "../theme/spacing";
import { Typography } from "../theme/typography";

interface ExerciseInputProps {
  value: Exercise;
  onChange: (value: Exercise) => void;
  // Keep the simple layout for student set-logging.
  showAdvancedFields?: boolean;
}

// Small controlled input component used for both creating workout plans
// and logging a workout. Keeps form markup reusable.
export const ExerciseInput: FC<ExerciseInputProps> = ({
  value,
  onChange,
  showAdvancedFields = true,
}) => {
  const updateField = (field: keyof Exercise, fieldValue: string) => {
    // Firestore stores `reps` as a string. We keep it as-is for reps,
    // while still parsing numeric fields that should remain numbers.
    let parsedValue: any;

    if (field === "sets" || field === "weight") {
      parsedValue = Number(fieldValue);
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
            value={String(value.weight ?? 0)}
            onChangeText={(text) => updateField("weight", text)}
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

