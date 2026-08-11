import { memo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PrimaryButton } from "../PrimaryButton";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";
import { useI18n } from "../../context/I18nContext";
import type { TrainingGroup } from "../../types/TrainingGroup";
import type { WeeklyProgress } from "@/utils/studentMetrics";

export interface StudentProgramProgressCardProps {
  latestGroup: TrainingGroup | null;
  assignedPct: number;
  compliancePct: number | null;
  weeklyProg: WeeklyProgress;
  onPressCard: () => void;
  onPressCreateGroup: () => void;
}

function StudentProgramProgressCardImpl({
  latestGroup,
  assignedPct,
  compliancePct,
  weeklyProg,
  onPressCard,
  onPressCreateGroup,
}: StudentProgramProgressCardProps) {
  const { t } = useI18n();
  return (
    <Pressable onPress={onPressCard} style={({ pressed }) => [styles.programCard, pressed && { opacity: 0.96 }]}>
      {latestGroup ? (
        <>
          <View style={styles.programHeader}>
            <View style={styles.programTitleCol}>
              <Text style={styles.programName}>{latestGroup.name}</Text>
              <Text style={styles.programSub}>
                {latestGroup.workoutsPerWeek
                  ? t("workoutsPerWeekChip", { n: latestGroup.workoutsPerWeek })
                  : t("daysPerWeekEmpty")}
              </Text>
            </View>
            <View style={styles.flashIconWrap}>
              <Ionicons name="flash" size={18} color={Colors.primary} />
            </View>
          </View>

          <View style={styles.progressBlock}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${assignedPct}%` }]} />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.mutedSecondary}>{t("progress")}</Text>
              <Text style={styles.mutedSecondary}>
                {typeof compliancePct === "number"
                  ? `${assignedPct}%`
                  : weeklyProg.target
                    ? t("weeklyProgressOfTarget", { completed: weeklyProg.completed, target: weeklyProg.target })
                    : "—"}
              </Text>
            </View>
          </View>

          <View style={styles.tapRow}>
            <Text style={styles.mutedSecondary}>{t("tapToViewAssignedWorkouts")}</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.programName}>{t("noActiveTrainingSplit")}</Text>
          <Text style={styles.emptySub}>{t("createSplitToStartAssigning")}</Text>
          <PrimaryButton title={t("createNewGroupAction")} onPress={onPressCreateGroup} style={styles.createGroupBtn} />
        </>
      )}
    </Pressable>
  );
}

export const StudentProgramProgressCard = memo(StudentProgramProgressCardImpl);

const styles = StyleSheet.create({
  programCard: {
    backgroundColor: "#121A26",
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    marginBottom: Spacing.md,
  },
  programHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.md },
  programTitleCol: { flex: 1, minWidth: 0 },
  programName: { ...Typography.title, fontSize: FontSizes.subheading },
  programSub: { ...Typography.secondary, color: Colors.textMuted, marginTop: 4 },
  flashIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    alignItems: "center",
    justifyContent: "center",
  },
  progressBlock: { marginTop: Spacing.md },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: Colors.surfaceHighlight, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: Colors.primary },
  progressLabels: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  mutedSecondary: { ...Typography.secondary, color: Colors.textMuted },
  tapRow: { marginTop: Spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  emptySub: { ...Typography.secondary, color: Colors.textMuted, marginTop: 6 },
  createGroupBtn: { backgroundColor: Colors.border, marginTop: Spacing.md },
});
