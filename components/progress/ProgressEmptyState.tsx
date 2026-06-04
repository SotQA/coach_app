import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { FontSizes, Typography } from "../../theme/typography";
import { useI18n } from "../../context/I18nContext";
import type { TimeRangePreset } from "../../utils/coachProgressAnalytics";

export type ProgressEmptyKind = "no-data" | "below-minimum" | "range-too-short";

interface ProgressEmptyStateProps {
  kind: ProgressEmptyKind;
  ctaLabel?: string;
  onCtaPress?: () => void;
  onSwitchRange?: (p: TimeRangePreset) => void;
}

const KIND_CONFIG: Record<
  ProgressEmptyKind,
  {
    icon: ComponentProps<typeof Ionicons>["name"];
    titleKey: string;
    subtitleKey: string;
  }
> = {
  "no-data": {
    icon: "trophy-outline",
    titleKey: "no_progress_data_yet",
    subtitleKey: "start_first_workout_to_unlock",
  },
  "below-minimum": {
    icon: "barbell-outline",
    titleKey: "almost_there",
    subtitleKey: "log_one_more_to_unlock_charts",
  },
  "range-too-short": {
    icon: "time-outline",
    titleKey: "not_enough_in_range",
    subtitleKey: "try_a_longer_range_or_log_more",
  },
};

function ProgressEmptyStateInner({
  kind,
  ctaLabel,
  onCtaPress,
  onSwitchRange,
}: ProgressEmptyStateProps) {
  const { t } = useI18n();
  const cfg = KIND_CONFIG[kind];

  const handleCta = onCtaPress ?? (onSwitchRange ? () => onSwitchRange("6m") : undefined);

  return (
    <View
      style={{
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: Colors.surfaceSubtle,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: Spacing.md,
        }}
      >
        <Ionicons name={cfg.icon} size={36} color={Colors.primary} />
      </View>

      <Text
        style={{
          ...Typography.section,
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        {t(cfg.titleKey)}
      </Text>

      <Text
        style={{
          ...Typography.secondary,
          color: Colors.textMuted,
          textAlign: "center",
          maxWidth: 280,
          marginBottom: handleCta ? Spacing.md : 0,
        }}
      >
        {t(cfg.subtitleKey)}
      </Text>

      {handleCta && ctaLabel && (
        <Pressable
          onPress={handleCta}
          style={({ pressed }) => ({
            backgroundColor: Colors.primary,
            borderRadius: Radius.pill,
            paddingVertical: 10,
            paddingHorizontal: Spacing.lg,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text
            style={{
              fontSize: FontSizes.caption,
              fontWeight: "700",
              color: Colors.onPrimary,
              letterSpacing: 0.3,
            }}
          >
            {ctaLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export const ProgressEmptyState = React.memo(ProgressEmptyStateInner);
