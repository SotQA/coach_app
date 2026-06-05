import React from "react";
import { Text, View } from "react-native";
import { Colors } from "../../theme/colors";
import { Radius } from "../../theme/spacing";
import { FontSizes } from "../../theme/typography";
import { useI18n } from "../../context/I18nContext";

type RosterStatus = "ahead" | "ontrack" | "slipping" | "lagging";

interface StatusPillProps {
  status: RosterStatus;
  size?: "sm" | "md";
  label?: string;
}

const STATUS_STYLES: Record<
  RosterStatus,
  { bg: string; text: string; i18nKey: string }
> = {
  ahead: {
    bg: "rgba(212,255,68,0.18)",
    text: Colors.primary,
    i18nKey: "status_ahead",
  },
  ontrack: {
    bg: "rgba(212,255,68,0.10)",
    text: Colors.primary,
    i18nKey: "status_ontrack",
  },
  slipping: {
    bg: Colors.warningTint,
    text: Colors.warning,
    i18nKey: "status_slipping",
  },
  lagging: {
    bg: Colors.dangerTint,
    text: Colors.danger,
    i18nKey: "status_lagging",
  },
};

const STATUS_A11Y_KEY: Record<RosterStatus, string> = {
  ahead: "status_a11y_ahead",
  ontrack: "status_a11y_ontrack",
  slipping: "status_a11y_slipping",
  lagging: "status_a11y_lagging",
};

function StatusPillInner({ status, size = "sm", label }: StatusPillProps) {
  const { t } = useI18n();
  const style = STATUS_STYLES[status];

  const paddingV = size === "md" ? 6 : 4;
  const paddingH = size === "md" ? 14 : 10;
  const fontSize = size === "md" ? FontSizes.caption : FontSizes.micro;

  const displayLabel = label ?? t(style.i18nKey);

  return (
    <View
      accessible
      accessibilityLabel={t(STATUS_A11Y_KEY[status])}
      style={{
        backgroundColor: style.bg,
        borderRadius: Radius.pill,
        paddingVertical: paddingV,
        paddingHorizontal: paddingH,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          fontSize,
          fontWeight: "700",
          color: style.text,
          letterSpacing: 0.3,
        }}
      >
        {displayLabel}
      </Text>
    </View>
  );
}

export const StatusPill = React.memo(StatusPillInner);
