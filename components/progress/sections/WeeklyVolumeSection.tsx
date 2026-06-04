import React from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { WeekBars } from "../WeekBars";
import { Colors } from "../../../theme/colors";
import { Radius, Spacing } from "../../../theme/spacing";
import { Typography } from "../../../theme/typography";
import { useI18n } from "../../../context/I18nContext";

interface WeeklyVolumeSectionProps {
  bars: { label: string; value: number }[];
}

function WeeklyVolumeSectionInner({ bars }: WeeklyVolumeSectionProps) {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const chartWidth = width - Spacing.md * 4;

  if (bars.length === 0) {
    return (
      <View
        style={{
          backgroundColor: Colors.card,
          borderRadius: Radius.md,
          padding: Spacing.md,
          marginBottom: Spacing.lg,
          alignItems: "center",
        }}
      >
        <Text style={{ ...Typography.secondary, color: Colors.textMuted, textAlign: "center" }}>
          {t("no_volume_data")}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: Spacing.lg }}>
      <Text style={{ ...Typography.section, marginBottom: Spacing.sm }}>{t("weekly_volume")}</Text>
      <View style={{ backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.sm }}>
        <WeekBars bars={bars} width={chartWidth} height={140} averageLine />
      </View>
    </View>
  );
}

export const WeeklyVolumeSection = React.memo(WeeklyVolumeSectionInner);
