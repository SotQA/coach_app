import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { useStudentProgress } from "../../hooks/useStudentProgress";
import { Colors } from "../../theme/colors";
import { FontSizes, Typography } from "../../theme/typography";
import { Spacing } from "../../theme/spacing";
import { TimeRangeChips } from "../../components/progress/TimeRangeChips";
import { ProgressEmptyState } from "../../components/progress/ProgressEmptyState";
import { HeroKpiBand } from "../../components/progress/sections/HeroKpiBand";
import { ConsistencyHeatmapSection } from "../../components/progress/sections/ConsistencyHeatmapSection";
import { StrengthSparklinesSection } from "../../components/progress/sections/StrengthSparklinesSection";
import { WeeklyVolumeSection } from "../../components/progress/sections/WeeklyVolumeSection";
import { RecentPRsSection } from "../../components/progress/sections/RecentPRsSection";
import { CoachingSignalsSection } from "../../components/progress/sections/CoachingSignalsSection";

export default function StudentProgressScreen() {
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = useStudentProgress(user);

  if (p.loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (p.error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: Spacing.md, backgroundColor: Colors.bg }}>
        <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>{p.error.message}</Text>
        <Text
          onPress={p.onRefresh}
          style={{ color: Colors.primary, fontWeight: "700", fontSize: FontSizes.caption }}
        >
          Retry
        </Text>
      </View>
    );
  }

  if (!p.hasAnyLogs) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, padding: Spacing.md, paddingTop: insets.top + Spacing.md }}>
        <Text style={{ ...Typography.title, fontSize: FontSizes.h2, marginBottom: Spacing.md }}>{t("progress")}</Text>
        <ProgressEmptyState
          kind="no-data"
          ctaLabel={t("start_a_workout")}
          onCtaPress={() => router.push("/student/workouts")}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + Spacing.md,
        paddingHorizontal: Spacing.md,
        paddingBottom: insets.bottom + Spacing.xl,
      }}
      refreshControl={
        <RefreshControl refreshing={p.refreshing} onRefresh={p.onRefresh} tintColor={Colors.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ ...Typography.title, fontSize: FontSizes.h2, marginBottom: Spacing.sm }}>
        {t("progress")}
      </Text>

      <TimeRangeChips value={p.timePreset} onChange={p.setTimePreset} />

      {!p.hasMinimumData ? (
        <>
          <ConsistencyHeatmapSection countsByDay={p.countsByDay} />
          <ProgressEmptyState
            kind="below-minimum"
            ctaLabel={t("log_a_workout")}
            onCtaPress={() => router.push("/student/workouts")}
          />
        </>
      ) : (
        <>
          <HeroKpiBand
            streakWeeks={p.streakWeeks}
            sessionsThisWeek={p.sessionsThisWeek}
            weeklyTarget={p.weeklyTarget}
            totalVolumeInRange={p.totalVolumeInRange}
            totalVolumeDeltaPct={p.totalVolumeDeltaPct}
          />
          <ConsistencyHeatmapSection countsByDay={p.countsByDay} />
          <StrengthSparklinesSection
            rows={p.strengthRows}
            hasMore={p.hasMoreStrengthRows}
            allRows={p.allStrengthRows}
          />
          <WeeklyVolumeSection bars={p.weeklyVolumeBars} />
          <RecentPRsSection prs={p.recentPRs} />
          <CoachingSignalsSection signals={p.coachingSignals} />
        </>
      )}
    </ScrollView>
  );
}
