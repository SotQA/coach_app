import React from "react";
import { Text, View } from "react-native";
import { StatusPill } from "../StatusPill";
import type { CoachingSignal } from "../../../utils/coachProgressAnalytics";
import { Colors } from "../../../theme/colors";
import { Radius, Spacing } from "../../../theme/spacing";
import { Typography } from "../../../theme/typography";
import { useI18n } from "../../../context/I18nContext";

interface CoachingSignalsSectionProps {
  signals: CoachingSignal[];
}

const BORDER_COLOR: Record<CoachingSignal["status"], string> = {
  green: Colors.primary,
  yellow: Colors.warning,
  red: Colors.danger,
};

function CoachingSignalsSectionInner({ signals }: CoachingSignalsSectionProps) {
  const { t } = useI18n();

  const greenCount = signals.filter((s) => s.status === "green").length;
  const yellowCount = signals.filter((s) => s.status === "yellow").length;
  const redCount = signals.filter((s) => s.status === "red").length;

  return (
    <View style={{ marginBottom: Spacing.lg }}>
      <Text style={{ ...Typography.section, marginBottom: Spacing.sm }}>{t("insights")}</Text>

      {signals.length === 0 ? (
        <View
          style={{
            backgroundColor: Colors.card,
            borderRadius: Radius.md,
            padding: Spacing.md,
            alignItems: "center",
          }}
        >
          <Text style={{ ...Typography.secondary, color: Colors.textMuted, textAlign: "center" }}>
            {t("no_insights_yet")}
          </Text>
        </View>
      ) : (
        <View>
          {/* Status count pills */}
          <View style={{ flexDirection: "row", gap: Spacing.xs, marginBottom: Spacing.sm }}>
            {greenCount > 0 && <StatusPill status="ontrack" label={String(greenCount)} />}
            {yellowCount > 0 && <StatusPill status="slipping" label={String(yellowCount)} />}
            {redCount > 0 && <StatusPill status="lagging" label={String(redCount)} />}
          </View>

          {/* Signal cards */}
          <View style={{ gap: Spacing.xs }}>
            {signals.map((signal, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  backgroundColor: Colors.card,
                  borderRadius: Radius.sm,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: 4,
                    backgroundColor: BORDER_COLOR[signal.status],
                  }}
                />
                <View style={{ flex: 1, padding: Spacing.sm }}>
                  <Text style={{ ...Typography.body }}>{signal.text}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

export const CoachingSignalsSection = React.memo(CoachingSignalsSectionInner);
