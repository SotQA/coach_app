import { FC } from "react";
import { View, Text, TextInput } from "react-native";
import type { Exercise } from "../types/Workout";

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
        marginVertical: 8,
        padding: 12,
        borderRadius: 16,
        backgroundColor: "#020617",
        borderWidth: 1,
        borderColor: "#1F2937",
      }}
    >
      <Text style={{ marginBottom: 4, color: "#E5E7EB", fontWeight: "500" }}>
        Exercise Name
      </Text>
      <TextInput
        placeholder="Bench Press"
        placeholderTextColor="#6B7280"
        value={value.name}
        onChangeText={(text) => updateField("name", text)}
        style={{
          borderWidth: 1,
          borderColor: "#1F2937",
          padding: 10,
          borderRadius: 10,
          marginBottom: 10,
          color: "white",
          backgroundColor: "#020617",
        }}
      />

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flex: 1, marginRight: 4 }}>
          <Text style={{ color: "#E5E7EB", marginBottom: 4 }}>Sets</Text>
          <TextInput
            keyboardType="numeric"
            value={String(value.sets)}
            onChangeText={(text) => updateField("sets", text)}
            style={{
              borderWidth: 1,
              borderColor: "#1F2937",
              padding: 10,
              borderRadius: 10,
              color: "white",
              backgroundColor: "#020617",
            }}
          />
        </View>

        <View style={{ flex: 1, marginHorizontal: 4 }}>
          <Text style={{ color: "#E5E7EB", marginBottom: 4 }}>Reps</Text>
          <TextInput
            keyboardType="numeric"
            value={String(value.reps)}
            onChangeText={(text) => updateField("reps", text)}
            style={{
              borderWidth: 1,
              borderColor: "#1F2937",
              padding: 10,
              borderRadius: 10,
              color: "white",
              backgroundColor: "#020617",
            }}
          />
        </View>

        <View style={{ flex: 1, marginLeft: 4 }}>
          <Text style={{ color: "#E5E7EB", marginBottom: 4 }}>Weight (kg)</Text>
          <TextInput
            keyboardType="numeric"
            value={String(value.weight ?? 0)}
            onChangeText={(text) => updateField("weight", text)}
            style={{
              borderWidth: 1,
              borderColor: "#1F2937",
              padding: 10,
              borderRadius: 10,
              color: "white",
              backgroundColor: "#020617",
            }}
          />
        </View>
      </View>
    </View>
  );
};

