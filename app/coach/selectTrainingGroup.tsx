import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { trainingGroupService } from "../../services/trainingGroupService";
import type { TrainingGroup } from "../../types/TrainingGroup";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenLayout } from "../../components/ScreenLayout";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";

export default function SelectTrainingGroup() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    studentId?: string;
    studentName?: string;
    selectedGroupId?: string;
  }>();

  const studentId = useMemo(() => String(params.studentId ?? "").trim(), [params.studentId]);
  const studentName = useMemo(() => String(params.studentName ?? "Student"), [params.studentName]);
  const preselectId = useMemo(() => String(params.selectedGroupId ?? "").trim(), [params.selectedGroupId]);

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<TrainingGroup[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!user || user.role !== "coach") throw new Error("You must be logged in as a coach.");
        if (!studentId) throw new Error("Missing student context.");
        const items = await trainingGroupService.getTrainingGroupsForStudent(user.id, studentId);
        setGroups(items);
        const nextSelected =
          (preselectId && items.some((g) => g.id === preselectId) ? preselectId : "") ||
          items[0]?.id ||
          "";
        setSelectedId(nextSelected);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load training groups.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id, user?.role, studentId, preselectId]);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedId) ?? null,
    [groups, selectedId]
  );

  return (
    <ScreenLayout>
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.bg }}
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.lg, paddingTop: Spacing.lg }}
      >
        <Text style={{ ...Typography.title, fontSize: 26, marginBottom: 6 }}>Select Training Group</Text>
        <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.md }}>
          For: {studentName}
        </Text>

        {loading ? (
          <View style={{ paddingVertical: Spacing.lg }}>
            <ActivityIndicator />
          </View>
        ) : error ? (
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
            <Text style={{ ...Typography.secondary, color: Colors.danger }}>{error}</Text>
          </View>
        ) : groups.length === 0 ? (
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
            <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>
              No groups yet. Create one to start programming.
            </Text>
          </View>
        ) : (
          <View style={{ gap: Spacing.sm, marginBottom: Spacing.md }}>
            <Text style={{ ...Typography.section, marginBottom: 2 }}>Recently used</Text>
            {groups.map((g, idx) => {
              const selected = g.id === selectedId;
              return (
                <Pressable
                  key={g.id}
                  onPress={() => setSelectedId(g.id)}
                  style={({ pressed }) => ({
                    padding: Spacing.md,
                    borderRadius: Radius.lg,
                    backgroundColor: selected ? Colors.surface : Colors.card,
                    borderWidth: 1,
                    borderColor: selected ? Colors.primary : Colors.border,
                    opacity: pressed ? 0.92 : 1,
                  })}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...Typography.section, fontWeight: "900" }}>{g.name}</Text>
                      <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }}>
                        {g.workoutsPerWeek} workouts/week
                      </Text>
                    </View>
                    {selected ? (
                      <View
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: Radius.pill,
                          backgroundColor: Colors.primary,
                        }}
                      >
                        <Text style={{ ...Typography.secondary, color: Colors.onPrimary, fontWeight: "900" }}>
                          Selected
                        </Text>
                      </View>
                    ) : idx === 0 ? (
                      <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>Recent</Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <PrimaryButton
          title="Continue"
          disabled={!selectedGroup}
          onPress={() => {
            if (!selectedGroup) return;
            router.replace({
              pathname: "/coach/createWorkoutPlan",
              params: {
                studentId,
                studentName,
                groupId: selectedGroup.id,
              },
            });
          }}
        />

        <View style={{ marginTop: Spacing.sm }}>
          <PrimaryButton
            title="+ Create New Group"
            onPress={() =>
              router.push({
                pathname: "/coach/createTrainingGroup",
                params: { studentId, studentName },
              })
            }
            style={{ backgroundColor: Colors.border }}
            textStyle={{ fontWeight: "900" }}
          />
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

