import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { trainingGroupService } from "../../services/trainingGroupService";
import type { TrainingGroupType } from "../../types/TrainingGroup";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenLayout } from "../../components/ScreenLayout";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";

const typeLabel = (t: TrainingGroupType): string => {
  switch (t) {
    case "Strength Block":
      return "Strength";
    case "Upper / Lower":
      return "Upper/Lower";
    default:
      return t;
  }
};

export default function CreateTrainingGroup() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ studentId?: string; studentName?: string }>();
  const studentId = useMemo(() => String(params.studentId ?? "").trim(), [params.studentId]);
  const studentName = useMemo(() => String(params.studentName ?? "Student"), [params.studentName]);

  const [type, setType] = useState<TrainingGroupType>("PPL");
  const [customName, setCustomName] = useState("");
  const [workoutsPerWeek, setWorkoutsPerWeek] = useState("4");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedName = useMemo(() => {
    if (type !== "Custom") return String(type);
    return customName.trim();
  }, [type, customName]);

  const canCreate = Boolean(studentId) && Boolean(user?.id) && Boolean(resolvedName) && !loading;

  const types: TrainingGroupType[] = [
    "Full Body",
    "Upper / Lower",
    "PPL",
    "Strength Block",
    "Hypertrophy",
    "Deload",
    "Conditioning",
    "Custom",
  ];

  return (
    <ScreenLayout>
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.bg }}
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.lg, paddingTop: Spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ ...Typography.title, fontSize: 26, marginBottom: 6 }}>Create Training Group</Text>
        <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.md }}>
          For: {studentName}
        </Text>

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
          <Text style={{ ...Typography.section, marginBottom: Spacing.sm }}>Type</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs }}>
            {types.map((t) => {
              const active = t === type;
              return (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  style={({ pressed }) => ({
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: Radius.pill,
                    backgroundColor: active ? Colors.primary : Colors.surface,
                    borderWidth: 1,
                    borderColor: active ? Colors.primary : Colors.border,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={{ ...Typography.secondary, color: active ? Colors.onPrimary : Colors.text }}>
                    {typeLabel(t)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {type === "Custom" ? (
            <View style={{ marginTop: Spacing.md }}>
              <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Group Name</Text>
              <TextInput
                value={customName}
                onChangeText={setCustomName}
                placeholder="e.g. Hypertrophy Block A"
                placeholderTextColor={Colors.textMuted}
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
          ) : null}

          <View style={{ marginTop: Spacing.md }}>
            <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Workouts per week</Text>
            <TextInput
              value={workoutsPerWeek}
              onChangeText={setWorkoutsPerWeek}
              placeholder="4"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
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

        {error ? (
          <Text style={{ ...Typography.secondary, color: Colors.danger, marginBottom: Spacing.sm }}>
            {error}
          </Text>
        ) : null}

        <PrimaryButton
          title={loading ? "Creating…" : "Create Group"}
          disabled={!canCreate}
          onPress={async () => {
            try {
              setError(null);
              setLoading(true);
              if (!user || user.role !== "coach") throw new Error("You must be logged in as a coach.");
              if (!studentId) throw new Error("Missing student context.");
              const wpw = Number(workoutsPerWeek);
              const created = await trainingGroupService.createTrainingGroup({
                coachId: user.id,
                studentId,
                type,
                name: resolvedName,
                workoutsPerWeek: Number.isFinite(wpw) ? wpw : 4,
              });

              // Return to select screen and auto-select the newly created group.
              router.replace({
                pathname: "/coach/selectTrainingGroup",
                params: { studentId, studentName, selectedGroupId: created.id },
              });
            } catch (e: any) {
              setError(e?.message ?? "Failed to create group.");
            } finally {
              setLoading(false);
            }
          }}
        />
      </ScrollView>
    </ScreenLayout>
  );
}

