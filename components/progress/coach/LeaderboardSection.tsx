import React from "react";
import { Pressable, Text, View } from "react-native";
import type { RosterEntry } from "../../../utils/rosterAggregates";
import { Avatar } from "../../Avatar";
import { Sparkline } from "../Sparkline";
import { useI18n } from "../../../context/I18nContext";
import { Colors } from "../../../theme/colors";
import { Radius, Spacing } from "../../../theme/spacing";
import { FontSizes, Typography } from "../../../theme/typography";

type LeaderboardMetric = "streak" | "prsInPeriod" | "sessionsInPeriod";

interface LeaderboardSectionProps {
  metric: LeaderboardMetric;
  onChangeMetric: (m: LeaderboardMetric) => void;
  top: RosterEntry[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelectStudent: (studentId: string) => void;
}

const METRICS: { key: LeaderboardMetric; i18nKey: string }[] = [
  { key: "streak", i18nKey: "most_consistent" },
  { key: "prsInPeriod", i18nKey: "most_prs" },
  { key: "sessionsInPeriod", i18nKey: "most_sessions" },
];

function metricValue(entry: RosterEntry, metric: LeaderboardMetric): string {
  if (metric === "streak") return `${entry.streakWeeks}w`;
  if (metric === "prsInPeriod") return `${entry.prsInPeriod ?? 0} PRs`;
  return `${entry.sessionsInPeriod}`;
}

function studentInitials(entry: RosterEntry): string {
  const f = entry.student.firstName?.[0] ?? "";
  const l = entry.student.lastName?.[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

function studentName(entry: RosterEntry): string {
  return `${entry.student.firstName ?? ""} ${entry.student.lastName ?? ""}`.trim() || "Student";
}

const RANK_COLORS = [Colors.primary, Colors.primary, Colors.textSecondary, Colors.textSecondary, Colors.textSecondary];

export function LeaderboardSection({ metric, onChangeMetric, top, collapsed, onToggleCollapse, onSelectStudent }: LeaderboardSectionProps) {
  const { t } = useI18n();

  return (
    <View>
      <Pressable
        onPress={onToggleCollapse}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: collapsed ? 0 : Spacing.sm }}
      >
        <Text style={Typography.section}>{t("leaderboard")}</Text>
        <Text style={{ color: Colors.textMuted, fontSize: FontSizes.subheading, transform: [{ rotate: collapsed ? "0deg" : "90deg" }] }}>›</Text>
      </Pressable>

      {!collapsed && (
        <View>
          <View style={{ flexDirection: "row", gap: Spacing.xs, marginBottom: Spacing.sm }}>
            {METRICS.map((m) => (
              <Pressable
                key={m.key}
                onPress={() => onChangeMetric(m.key)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: Radius.pill,
                  backgroundColor: metric === m.key ? Colors.primary : Colors.card,
                  borderWidth: 1,
                  borderColor: metric === m.key ? Colors.primary : Colors.border,
                }}
              >
                <Text style={{ fontSize: FontSizes.caption, fontWeight: "700", color: metric === m.key ? Colors.onPrimary : Colors.textSecondary }}>
                  {t(m.i18nKey)}
                </Text>
              </Pressable>
            ))}
          </View>

          {top.length === 0 ? (
            <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>{t("roster_too_new_to_rank")}</Text>
          ) : (
            <View style={{ gap: Spacing.xs }}>
              {top.map((entry, idx) => (
                <Pressable
                  key={entry.student.id}
                  onPress={() => onSelectStudent(entry.student.id)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: Colors.card,
                    borderRadius: 12,
                    paddingHorizontal: Spacing.sm,
                    paddingVertical: 10,
                    gap: Spacing.sm,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Text style={{ fontSize: FontSizes.caption, fontWeight: "800", color: RANK_COLORS[idx] ?? Colors.textMuted, width: 20, textAlign: "center" }}>
                    {idx + 1}
                  </Text>
                  <Avatar size={36} photoURL={entry.student.photoURL} initials={studentInitials(entry)} />
                  <Text style={{ ...Typography.section, fontSize: 14, flex: 1 }} numberOfLines={1}>
                    {studentName(entry)}
                  </Text>
                  <Text style={{ fontSize: FontSizes.caption, fontWeight: "700", color: Colors.textSecondary, marginRight: Spacing.xs }}>
                    {metricValue(entry, metric)}
                  </Text>
                  <Sparkline points={entry.sessionsPerWeekSeries} width={60} height={24} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
