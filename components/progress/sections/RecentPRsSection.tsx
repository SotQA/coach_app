import React from "react";
import { ScrollView, Text, View } from "react-native";
import { PrTimelineCard } from "../PrTimelineCard";
import type { PRRecord } from "../../../utils/coachProgressAnalytics";
import { Colors } from "../../../theme/colors";
import { Radius, Spacing } from "../../../theme/spacing";
import { Typography } from "../../../theme/typography";
import { useI18n } from "../../../context/I18nContext";

interface RecentPRsSectionProps {
  prs: PRRecord[];
}

function RecentPRsSectionInner({ prs }: RecentPRsSectionProps) {
  const { t } = useI18n();

  return (
    <View style={{ marginBottom: Spacing.lg }}>
      <Text style={{ ...Typography.section, marginBottom: Spacing.sm }}>{t("recent_prs")}</Text>

      {prs.length === 0 ? (
        <View
          style={{
            backgroundColor: Colors.card,
            borderRadius: Radius.md,
            padding: Spacing.md,
            alignItems: "center",
          }}
        >
          <Text style={{ ...Typography.section, marginBottom: 6, textAlign: "center" }}>
            {t("no_prs_yet")}
          </Text>
          <Text style={{ ...Typography.secondary, color: Colors.textMuted, textAlign: "center" }}>
            Keep pushing
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingRight: Spacing.md }}
        >
          {prs.map((pr) => (
            <PrTimelineCard
              key={`${pr.logId}-${pr.exerciseName}`}
              date={new Date(pr.completedAtMs)}
              exerciseName={pr.exerciseName}
              weightKg={pr.weightKg}
              reps={pr.reps}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export const RecentPRsSection = React.memo(RecentPRsSectionInner);
