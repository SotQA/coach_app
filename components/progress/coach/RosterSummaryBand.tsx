import React from "react";
import { View } from "react-native";
import { HeroKpiCard } from "../HeroKpiCard";
import type { RosterSummary } from "../../../utils/rosterAggregates";
import { useI18n } from "../../../context/I18nContext";
import { Spacing } from "../../../theme/spacing";

interface RosterSummaryBandProps {
  summary: RosterSummary;
  totalPRsInPeriod: number;
  totalPRsDeltaPct: number | null;
}

export function RosterSummaryBand({ summary, totalPRsInPeriod, totalPRsDeltaPct: _delta }: RosterSummaryBandProps) {
  const { t } = useI18n();
  return (
    <View style={{ flexDirection: "row", gap: Spacing.xs, marginBottom: Spacing.md }}>
      <HeroKpiCard
        label="Active"
        value={`${summary.activeLast14d} / ${summary.total}`}
        subtitle={t("active_last_14d")}
      />
      <HeroKpiCard
        label={t("status_ontrack")}
        value={`${summary.percentOnTrack}%`}
        subtitle={t("of_roster_this_week")}
      />
      <HeroKpiCard
        label="PRs"
        value={`${totalPRsInPeriod}`}
        subtitle={t("prs_last_28d")}
      />
    </View>
  );
}
