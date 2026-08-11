import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { trainingGroupService } from "../../services/trainingGroupService";
import type { TrainingGroup } from "../../types/TrainingGroup";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenLayout } from "../../components/ScreenLayout";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";
import { Swipeable } from "react-native-gesture-handler";

export default function SelectTrainingGroup() {
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    studentId?: string;
    studentName?: string;
    selectedGroupId?: string;
  }>();

  const studentId = useMemo(() => String(params.studentId ?? "").trim(), [params.studentId]);
  const studentName = useMemo(() => String(params.studentName ?? t("roleStudent")), [params.studentName, t]);
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
        if (!user || user.role !== "coach") throw new Error(t("mustBeLoggedInAsCoachError"));
        if (!studentId) throw new Error(t("missingStudentContextError"));
        const items = await trainingGroupService.getTrainingGroupsForStudent(user.id, studentId);
        setGroups(items);
        const nextSelected =
          (preselectId && items.some((g) => g.id === preselectId) ? preselectId : "") ||
          items[0]?.id ||
          "";
        setSelectedId(nextSelected);
      } catch (e: any) {
        setError(e?.message ?? t("failedToLoadTrainingGroupsError"));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id, user?.role, studentId, preselectId, t]);

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
        <Text style={{ ...Typography.title, fontSize: FontSizes.h2, marginBottom: 6 }}>{t("selectTrainingGroupTitle")}</Text>
        <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.md }}>
          {t("forStudentLabel", { name: studentName })}
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
              {t("noGroupsYet")}
            </Text>
          </View>
        ) : (
          <View style={{ gap: Spacing.sm, marginBottom: Spacing.md }}>
            <Text style={{ ...Typography.section, marginBottom: 2 }}>{t("recentlyUsed")}</Text>
            {groups.map((g, idx) => {
              const selected = g.id === selectedId;
              return (
                <Swipeable
                  key={g.id}
                  rightThreshold={48}
                  renderRightActions={() => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("deleteGroupA11y", { name: g.name })}
                      onPress={() => {
                        Alert.alert(
                          t("deleteGroupConfirmTitle"),
                          t("deleteGroupConfirmBody"),
                          [
                            { text: t("cancel"), style: "cancel" },
                            {
                              text: t("delete"),
                              style: "destructive",
                              onPress: async () => {
                                try {
                                  if (!user || user.role !== "coach") throw new Error(t("mustBeLoggedInAsCoachError"));
                                  await trainingGroupService.deleteTrainingGroup(g.id, user.id);
                                  setGroups((prev) => prev.filter((x) => x.id !== g.id));
                                  setSelectedId((prevSel) => {
                                    if (prevSel !== g.id) return prevSel;
                                    const remaining = groups.filter((x) => x.id !== g.id);
                                    return remaining[0]?.id ?? "";
                                  });
                                } catch (e: any) {
                                  Alert.alert(t("failedToDeleteTitle"), e?.message ?? t("unknownErrorFallback"));
                                }
                              },
                            },
                          ]
                        );
                      }}
                      style={({ pressed }) => ({
                        marginLeft: Spacing.sm,
                        marginBottom: Spacing.sm,
                        paddingHorizontal: 16,
                        borderRadius: Radius.lg,
                        backgroundColor: "#7F1D1D",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.9 : 1,
                      })}
                    >
                      <Text style={{ ...Typography.section, fontWeight: "900", color: "#FFFFFF" }}>{t("delete")}</Text>
                    </Pressable>
                  )}
                >
                  <Pressable
                    onPress={() => setSelectedId(g.id)}
                    style={({ pressed }) => ({
                      padding: Spacing.md,
                      borderRadius: Radius.lg,
                      backgroundColor: selected ? Colors.surface : Colors.card,
                      borderWidth: 1,
                      borderColor: selected ? Colors.primary : Colors.border,
                      opacity: pressed ? 0.92 : 1,
                      marginBottom: Spacing.sm,
                    })}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...Typography.section, fontWeight: "900" }}>{g.name}</Text>
                        <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }}>
                          {t("workoutsPerWeekChip", { n: g.workoutsPerWeek })}
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
                            {t("selectedBadge")}
                          </Text>
                        </View>
                      ) : idx === 0 ? (
                        <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>{t("recentBadge")}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                </Swipeable>
              );
            })}
          </View>
        )}

        <PrimaryButton
          title={t("continue")}
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
            title={t("createNewGroupPlus")}
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



