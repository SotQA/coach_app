import { FC } from "react";
import { View, Text, TextInput } from "react-native";
import type { Exercise } from "../types/Workout";
import { Colors } from "../theme/colors";
import { Radius, Spacing } from "../theme/spacing";
import { Typography } from "../theme/typography";

interface ExerciseInputProps {
  value: Exercise;
  onChange: (value: Exercise) => void;
}

// Small controlled input component used for both creating workout plans
// and logging a workout. Keeps form markup reusable.
export const ExerciseInput: FC<ExerciseInputProps> = ({ value, onChange }) => {
  const updateField = (field: keyof Exercise, fieldValue: string) => {
    const parsedValue =
      field === "sets" || field === "reps" || field === "weight"
        ? Number(fieldValue)
        : fieldValue;

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
            keyboardType="numeric"
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
    </View>
  );
};

