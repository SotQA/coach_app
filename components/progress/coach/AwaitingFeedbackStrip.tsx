import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { WorkoutLog } from "../../../types/Workout";
import type { StudentSummary } from "../../../types/StudentSummary";
import { Avatar } from "../../Avatar";
import { useI18n } from "../../../context/I18nContext";
import { Colors } from "../../../theme/colors";
import { Radius, Spacing } from "../../../theme/spacing";
import { FontSizes, Typography } from "../../../theme/typography";
import { logCompletedMs } from "../../../utils/coachProgressAnalytics";

interface AwaitingFeedbackStripProps {
  logs: WorkoutLog[];
  onSelect: (log: WorkoutLog) => void;
  studentsById?: Map<string, StudentSummary>;
}

function daysAgoLabel(log: WorkoutLog, t: (key: string, opts?: any) => string): string {
  const ms = logCompletedMs(log);
  if (!ms) return "";
  const days = Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
  if (days === 0) return t("today");
  if (days === 1) return t("yesterday");
  return t("daysAgo", { n: days });
}

function studentInitials(s: StudentSummary | undefined): string {
  if (!s) return "?";
  const f = s.firstName?.[0] ?? "";
  const l = s.lastName?.[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

function AwaitingFeedbackStripInner({ logs, onSelect, studentsById }: AwaitingFeedbackStripProps) {
  const { t } = useI18n();

  if (logs.length === 0) {
    return (
      <View style={{ marginBottom: Spacing.md }}>
        <Text style={{ ...Typography.section, marginBottom: Spacing.xs }}>
          {t("awaiting_feedback")}
        </Text>
        <View style={{
          backgroundColor: Colors.card,
          borderRadius: Radius.md,
          padding: Spacing.md,
          borderWidth: 1,
          borderColor: Colors.border,
        }}>
          <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>{t("all_caught_up")}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: Spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.xs, gap: Spacing.xs }}>
        <Text style={Typography.section}>{t("awaiting_feedback")}</Text>
        <View style={{ backgroundColor: Colors.primary, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ fontSize: FontSizes.tiny, fontWeight: "700", color: Colors.onPrimary }}>{logs.length}</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: Spacing.xs }}>
          {logs.map((log) => {
            const student = studentsById?.get(log.studentId);
            const name = student ? `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() || "Student" : "Student";
            return (
              <Pressable
                key={log.id}
                onPress={() => onSelect(log)}
                style={({ pressed }) => ({
                  width: 240,
                  height: 110,
                  backgroundColor: Colors.card,
                  borderRadius: Radius.md,
                  borderWidth: 1.5,
                  borderColor: Colors.primary,
                  padding: Spacing.sm,
                  opacity: pressed ? 0.75 : 1,
                  justifyContent: "space-between",
                })}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs }}>
                  <Avatar size={32} photoURL={student?.photoURL} initials={studentInitials(student)} />
                  <Text style={{ ...Typography.section, flex: 1 }} numberOfLines={1}>{name}</Text>
                </View>
                <Text style={{ ...Typography.body, color: Colors.text }} numberOfLines={1}>
                  {log.workoutName}
                </Text>
                <Text style={{ ...Typography.secondary, fontSize: FontSizes.caption }}>
                  {daysAgoLabel(log, t)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

export const AwaitingFeedbackStrip = React.memo(AwaitingFeedbackStripInner);
