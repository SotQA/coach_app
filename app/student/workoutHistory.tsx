import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useWorkoutHistory } from "@/hooks/useWorkoutHistory";
import { PrimaryButton } from "@/components/PrimaryButton";
import { EmptyState } from "@/components/EmptyState";
import { ScreenLayout } from "@/components/ScreenLayout";
import { WorkoutHistoryFilter } from "@/components/history/WorkoutHistoryFilter";
import { WorkoutCalendar } from "@/components/history/WorkoutCalendar";
import { WorkoutLogList } from "@/components/history/WorkoutLogList";
import { Colors } from "@/theme/colors";
import { Radius, Spacing } from "@/theme/spacing";
import { FontSizes, Typography } from "@/theme/typography";

/**
 * Student workout-history screen.
 *
 * All state and derivations (data load, month nav, filter, day selection,
 * expand/collapse) live in `useWorkoutHistory`. This screen orchestrates
 * the layout and renders three child components: filter chips, calendar,
 * and the per-day session list.
 */
export default function WorkoutHistory() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const h = useWorkoutHistory(user);

  // ── Loading / error / global-empty branches ───────────────────────────
  if (h.loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: Colors.bg,
        }}
      >
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (h.loadError) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: Spacing.md,
          backgroundColor: Colors.bg,
        }}
      >
        <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>
          {h.loadError.message}
        </Text>
        <PrimaryButton title="Go to Login" onPress={() => router.replace("/login")} />
      </View>
    );
  }

  if (!h.hasAnyLogs) {
    return (
      <ScreenLayout>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            padding: Spacing.md,
            paddingTop: insets.top + Spacing.md,
            backgroundColor: Colors.bg,
          }}
        >
          <Text
            style={{
              ...Typography.title,
              fontSize: FontSizes.h2,
              marginBottom: Spacing.xs,
            }}
          >
            History
          </Text>
          <Text
            style={{
              ...Typography.secondary,
              color: Colors.textMuted,
              marginBottom: Spacing.lg,
            }}
          >
            {h.monthLabel}
          </Text>
          <EmptyState
            icon="calendar-outline"
            title="No workouts yet"
            subtitle="Complete a workout from your plan to see it on the calendar."
          />
          <View style={{ marginTop: Spacing.lg }}>
            <PrimaryButton
              title="View Workouts"
              onPress={() => router.replace("/student/workouts")}
            />
          </View>
        </ScrollView>
      </ScreenLayout>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────
  return (
    <ScreenLayout>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={h.refreshing}
            onRefresh={h.onRefresh}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={{
          paddingBottom: insets.bottom + Spacing.xl,
          backgroundColor: Colors.bg,
        }}
      >
        <View
          style={{
            paddingHorizontal: Spacing.md,
            paddingTop: insets.top + Spacing.md,
          }}
        >
          {/* Header: title + month label + settings shortcut */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: Spacing.sm,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ ...Typography.title, fontSize: FontSizes.h2 }}>
                History
              </Text>
              <Text
                style={{
                  ...Typography.secondary,
                  color: Colors.textMuted,
                  marginTop: 4,
                }}
              >
                {h.monthLabel}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              onPress={() => router.push("/student/profile")}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: Radius.xl,
                backgroundColor: Colors.card,
                borderWidth: 1,
                borderColor: Colors.border,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.88 : 1,
              })}
            >
              <Ionicons name="person-outline" size={22} color={Colors.primary} />
            </Pressable>
          </View>

          <WorkoutCalendar
            cells={h.calendarCells}
            countsByDay={h.countsByDay}
            heatOpacity={h.heatOpacity}
            selectedDayKey={h.selectedDayKey}
            todayKey={h.todayKey}
            onSelectDay={h.setSelectedDayKey}
            onPrevMonth={h.goToPrevMonth}
            onNextMonth={h.goToNextMonth}
            onCurrentMonth={h.goToCurrentMonth}
          />

          <WorkoutHistoryFilter
            chips={h.chipsPresent}
            active={h.filterCategory}
            onChange={h.setFilterCategory}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: Spacing.sm,
            }}
          >
            <Text
              style={{
                ...Typography.section,
                fontSize: 17,
                fontWeight: "800",
                flex: 1,
              }}
              numberOfLines={2}
            >
              {h.selectedDayLabel || "Select a day"}
            </Text>
            <Text
              style={{
                ...Typography.secondary,
                color: Colors.textMuted,
                fontWeight: "600",
              }}
            >
              {h.logsForSelectedDay.length}{" "}
              {h.logsForSelectedDay.length === 1 ? "session" : "sessions"}
            </Text>
          </View>

          <WorkoutLogList
            logs={h.logsForSelectedDay}
            expandedLogId={h.expandedLogId}
            onToggleExpanded={h.toggleLogExpanded}
          />

          <View style={{ marginTop: Spacing.md }}>
            <PrimaryButton
              title="View Workouts"
              onPress={() => router.replace("/student/workouts")}
              style={{ backgroundColor: Colors.border }}
            />
          </View>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}
