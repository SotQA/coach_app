import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../../context/AuthContext";
import { useI18n } from "../../../context/I18nContext";
import { useCoachProgress } from "../../../hooks/useCoachProgress";
import { RosterSummaryBand } from "../../../components/progress/coach/RosterSummaryBand";
import { AwaitingFeedbackStrip } from "../../../components/progress/coach/AwaitingFeedbackStrip";
import { AttentionListItem, ATTENTION_ITEM_HEIGHT } from "../../../components/progress/coach/AttentionListItem";
import { LeaderboardSection } from "../../../components/progress/coach/LeaderboardSection";
import type { RosterEntry } from "../../../utils/rosterAggregates";
import type { StudentSummary } from "../../../types/StudentSummary";
import { Colors } from "../../../theme/colors";
import { FontSizes, Typography } from "../../../theme/typography";
import { Spacing } from "../../../theme/spacing";

function CoachEmptyRosterState({ onCtaPress }: { onCtaPress: () => void }) {
  const { t } = useI18n();
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: Spacing.lg, backgroundColor: Colors.bg }}>
      <Text style={{ ...Typography.section, textAlign: "center", marginBottom: Spacing.sm }}>{t("no_roster_yet")}</Text>
      <Text style={{ ...Typography.secondary, textAlign: "center", marginBottom: Spacing.lg }}>{t("add_student_to_see_progress")}</Text>
      <Pressable
        onPress={onCtaPress}
        style={{ backgroundColor: Colors.primary, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12 }}
      >
        <Text style={{ color: Colors.onPrimary, fontWeight: "700" }}>{t("add_student")}</Text>
      </Pressable>
    </View>
  );
}

export default function CoachProgress() {
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useCoachProgress(user?.id);
  const [leaderboardCollapsed, setLeaderboardCollapsed] = useState(true);

  if (c.loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (c.error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: Spacing.md, backgroundColor: Colors.bg }}>
        <Text style={{ color: Colors.danger }}>{c.error.message}</Text>
      </View>
    );
  }

  if (!c.hasRoster) {
    return <CoachEmptyRosterState onCtaPress={() => router.push("/coach/createStudent" as any)} />;
  }

  const goToStudent = (studentId: string) =>
    router.push({ pathname: "/coach/studentDetails", params: { studentId } } as any);

  const studentsById = new Map<string, StudentSummary>(
    c.attentionList.map((e: RosterEntry) => [e.student.id, e.student]),
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: Colors.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + Spacing.md,
        paddingHorizontal: Spacing.md,
        paddingBottom: insets.bottom + Spacing.xl,
      }}
      data={c.attentionList}
      keyExtractor={(e: RosterEntry) => e.student.id}
      getItemLayout={(_: any, index: number) => ({ length: ATTENTION_ITEM_HEIGHT, offset: ATTENTION_ITEM_HEIGHT * index, index })}
      renderItem={({ item }: { item: RosterEntry }) => (
        <AttentionListItem entry={item} onPress={() => goToStudent(item.student.id)} />
      )}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.xs }} />}
      ListHeaderComponent={
        <View>
          <Text style={{ ...Typography.title, fontSize: FontSizes.h2, marginBottom: Spacing.sm }}>
            {t("progress")}
          </Text>
          <RosterSummaryBand
            summary={c.summary}
            totalPRsInPeriod={c.totalPRsInPeriod}
            totalPRsDeltaPct={c.totalPRsDeltaPct}
          />
          <AwaitingFeedbackStrip
            logs={c.awaitingFeedback}
            onSelect={(log) => router.push({ pathname: "/coach/workoutLogFeedback", params: { logId: log.id } } as any)}
            studentsById={studentsById}
          />
          <Text style={{ ...Typography.section, marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
            {t("needs_attention")}
          </Text>
        </View>
      }
      ListFooterComponent={
        <View style={{ marginTop: Spacing.lg }}>
          <LeaderboardSection
            metric={c.leaderboardMetric}
            onChangeMetric={c.setLeaderboardMetric}
            top={c.leaderboardTop}
            collapsed={leaderboardCollapsed}
            onToggleCollapse={() => setLeaderboardCollapsed((v) => !v)}
            onSelectStudent={goToStudent}
          />
        </View>
      }
      refreshControl={
        <RefreshControl refreshing={c.refreshing} onRefresh={c.onRefresh} tintColor={Colors.primary} />
      }
      removeClippedSubviews
      showsVerticalScrollIndicator={false}
    />
  );
}
