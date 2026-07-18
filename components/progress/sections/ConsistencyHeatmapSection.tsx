import React from "react";
import { Text, View } from "react-native";
import { ConsistencyHeatmap } from "../ConsistencyHeatmap";
import { Colors } from "../../../theme/colors";
import { Spacing } from "../../../theme/spacing";
import { Typography } from "../../../theme/typography";
import { useI18n } from "../../../context/I18nContext";

interface ConsistencyHeatmapSectionProps {
  countsByDay: Record<string, number>;
}

function ConsistencyHeatmapSectionInner({ countsByDay }: ConsistencyHeatmapSectionProps) {
  const { t } = useI18n();
  const totalSessions = Object.values(countsByDay).reduce((s, n) => s + n, 0);

  return (
    <View style={{ marginBottom: Spacing.lg }}>
      <Text style={{ ...Typography.section, marginBottom: Spacing.sm }}>{t("consistency")}</Text>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={t("a11y_heatmap_summary", { sessions: totalSessions, weeks: 12 })}
      >
        <ConsistencyHeatmap
          countsByDay={countsByDay}
          endDate={new Date()}
          weeks={12}
          cellSize={12}
          gap={3}
        />
      </View>
      {totalSessions === 0 && (
        <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: Spacing.sm }}>
          {t("no_recent_sessions")}
        </Text>
      )}
    </View>
  );
}

export const ConsistencyHeatmapSection = React.memo(ConsistencyHeatmapSectionInner);
