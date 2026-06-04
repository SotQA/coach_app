import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { HeroKpiCard } from "../HeroKpiCard";
import { Colors } from "../../../theme/colors";
import { Spacing } from "../../../theme/spacing";
import { useI18n } from "../../../context/I18nContext";
import { useUnits } from "../../../context/UnitsContext";

interface HeroKpiBandProps {
  streakWeeks: number;
  sessionsThisWeek: number;
  weeklyTarget: number | null;
  totalVolumeInRange: number;
  totalVolumeDeltaPct: number | null;
}

function ProgressRing({ fill, size = 36 }: { fill: number; size?: number }) {
  const r = size / 2 - 3;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference * (1 - Math.min(1, Math.max(0, fill)));
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={Colors.border} strokeWidth={2.5} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={Colors.primary}
        strokeWidth={2.5}
        fill="none"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={`${strokeDashoffset}`}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function HeroKpiBandInner({
  streakWeeks,
  sessionsThisWeek,
  weeklyTarget,
  totalVolumeInRange,
  totalVolumeDeltaPct,
}: HeroKpiBandProps) {
  const { t } = useI18n();
  const { formatWeight } = useUnits();

  const streakCard = useMemo(() => ({
    label: t("streak"),
    value: String(streakWeeks),
    subtitle: t(streakWeeks === 1 ? "weeks_one" : "weeks_other", { count: streakWeeks }),
  }), [streakWeeks, t]);

  const sessionsCard = useMemo(() => ({
    label: t("sessions_this_week"),
    value: weeklyTarget != null ? `${sessionsThisWeek} / ${weeklyTarget}` : String(sessionsThisWeek),
    rightSlot: weeklyTarget != null ? (
      <ProgressRing fill={sessionsThisWeek / weeklyTarget} size={36} />
    ) : undefined,
  }), [sessionsThisWeek, weeklyTarget, t]);

  const volumeCard = useMemo(() => {
    const pct = totalVolumeDeltaPct;
    const delta =
      pct == null
        ? { value: t("no_change"), direction: "flat" as const }
        : pct > 0
        ? { value: `+${pct.toFixed(1)}%`, direction: "up" as const }
        : pct < 0
        ? { value: `${pct.toFixed(1)}%`, direction: "down" as const }
        : { value: t("no_change"), direction: "flat" as const };
    return {
      label: t("volume_in_range"),
      value: formatWeight(totalVolumeInRange),
      delta,
    };
  }, [totalVolumeInRange, totalVolumeDeltaPct, formatWeight, t]);

  return (
    <View style={{ flexDirection: "row", gap: Spacing.xs, marginBottom: Spacing.lg }}>
      <HeroKpiCard label={streakCard.label} value={streakCard.value} subtitle={streakCard.subtitle} />
      <HeroKpiCard
        label={sessionsCard.label}
        value={sessionsCard.value}
        rightSlot={sessionsCard.rightSlot}
      />
      <HeroKpiCard label={volumeCard.label} value={volumeCard.value} delta={volumeCard.delta} />
    </View>
  );
}

export const HeroKpiBand = React.memo(HeroKpiBandInner);
