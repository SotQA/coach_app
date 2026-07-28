import { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, SectionList, RefreshControl, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { studentService } from "../../services/studentService";
import { workoutService } from "../../services/workoutService";
import type { StudentSummary } from "../../types/StudentSummary";
import type { WorkoutLog } from "../../types/Workout";
import { Avatar } from "../../components/Avatar";
import { ScreenLayout } from "../../components/ScreenLayout";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";
import { formatDateShort, formatRelativeTime } from "../../utils/formatLocale";
import { getUserInitials, getDisplayName } from "../../utils/userDisplay";
import { toMs } from "../../utils/dateConvert";

type FilterKey = "all" | "unread" | "read";

/**
 * Splits the localized "Completed X" string around the literal workout name so it can be
 * highlighted, without assuming any particular word order (safe across en/pl/ru phrasing).
 */
function CompletedLine({ workoutName, t }: { workoutName: string; t: (k: string, o?: Record<string, unknown>) => string }) {
  const full = t("completedWorkoutNotif", { workout: workoutName });
  const idx = full.indexOf(workoutName);
  if (idx === -1) {
    return <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>{full}</Text>;
  }
  const before = full.slice(0, idx);
  const after = full.slice(idx + workoutName.length);
  return (
    <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>
      {before}
      <Text style={{ color: Colors.primary, fontWeight: "700" }}>{workoutName}</Text>
      {after}
    </Text>
  );
}

function NotificationRow({
  log,
  student,
  onPress,
  t,
  locale,
}: {
  log: WorkoutLog;
  student: StudentSummary | undefined;
  onPress: () => void;
  t: (k: string, o?: Record<string, unknown>) => string;
  locale: Parameters<typeof formatDateShort>[1];
}) {
  const isUnread = log.notificationRead === false;
  const initials = getUserInitials(student, "?");
  const name = getDisplayName(student, "Student");
  const ms = toMs(log.completedAt);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "flex-start",
        gap: Spacing.sm,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        backgroundColor: isUnread ? Colors.surface : "transparent",
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {isUnread ? (
        <View
          style={{
            position: "absolute",
            left: 6,
            top: 22,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: Colors.primary,
          }}
        />
      ) : null}
      <Avatar
        photoURL={student?.photoURL}
        initials={initials}
        size={40}
        backgroundColor={Colors.surface}
        textColor={Colors.text}
        borderColor={Colors.primary}
        borderWidth={2}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...Typography.section, fontSize: FontSizes.note, fontWeight: "700" }}>{name}</Text>
        <CompletedLine workoutName={log.workoutName} t={t} />
        <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontSize: FontSizes.tiny, marginTop: 4 }}>
          {ms ? formatRelativeTime(ms, t, locale) : ""}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={{ alignSelf: "center" }} />
    </Pressable>
  );
}

export default function CoachNotifications() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const params = useLocalSearchParams<{ scope?: string }>();
  const todayOnly = params.scope === "today";

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!user || user.role !== "coach") return;
    setError(null);
    try {
      const [studentList, notifLogs] = await Promise.all([
        studentService.getStudentsForCoach(user.id),
        workoutService.getNotificationLogsForCoach(user.id),
      ]);
      setStudents(studentList);
      setLogs(notifLogs);
    } catch (e: any) {
      setError(e?.message ?? t("failedToLoad"));
    }
  }, [user?.id, user?.role, t]);

  // Only show the full-screen spinner on first mount — refetching silently on
  // every return-to-focus (e.g. back from workoutComparison) avoids a jarring
  // flash of the whole list being replaced by a spinner each time.
  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnce.current) setLoading(true);
      load().finally(() => {
        setLoading(false);
        hasLoadedOnce.current = true;
      });
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const studentById = useMemo(() => {
    const map = new Map<string, StudentSummary>();
    for (const s of students) map.set(s.id, s);
    return map;
  }, [students]);

  const unreadCount = useMemo(() => logs.filter((l) => l.notificationRead === false).length, [logs]);

  const handleMarkAllRead = async () => {
    if (!user || unreadCount === 0) return;
    setLogs((prev) => prev.map((l) => ({ ...l, notificationRead: true })));
    try {
      await workoutService.markAllNotificationsRead(user.id);
    } catch {
      load();
    }
  };

  const handleOpen = (log: WorkoutLog) => {
    if (log.notificationRead === false) {
      setLogs((prev) => prev.map((l) => (l.id === log.id ? { ...l, notificationRead: true } : l)));
      workoutService.markNotificationRead(log.id).catch(() => {});
    }
    router.push({ pathname: "/coach/workoutComparison" as any, params: { logId: log.id } });
  };

  const scopedLogs = useMemo(() => {
    if (!todayOnly) return logs;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();
    return logs.filter((l) => toMs(l.completedAt) >= todayMs);
  }, [logs, todayOnly]);

  const filteredLogs = useMemo(() => {
    if (filter === "unread") return scopedLogs.filter((l) => l.notificationRead === false);
    if (filter === "read") return scopedLogs.filter((l) => l.notificationRead !== false);
    return scopedLogs;
  }, [scopedLogs, filter]);

  const sections = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const todayMs = todayStart.getTime();
    const yestMs = yesterdayStart.getTime();

    const groups = new Map<string, WorkoutLog[]>();
    const order: string[] = [];
    for (const log of filteredLogs) {
      const ms = toMs(log.completedAt);
      const key = ms >= todayMs ? t("today") : ms >= yestMs ? t("yesterday") : formatDateShort(ms, locale);
      if (!groups.has(key)) {
        groups.set(key, []);
        order.push(key);
      }
      groups.get(key)!.push(log);
    }
    return order.map((title) => ({ title, data: groups.get(title)! }));
  }, [filteredLogs, locale, t]);

  const filterOptions: { key: FilterKey; labelKey: string }[] = [
    { key: "all", labelKey: "notificationsTabAll" },
    { key: "unread", labelKey: "notificationsTabUnread" },
    { key: "read", labelKey: "notificationsTabRead" },
  ];

  return (
    <ScreenLayout>
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        <View
          style={{
            position: "relative",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: Spacing.md,
            paddingTop: Spacing.sm,
            paddingBottom: Spacing.xs,
          }}
        >
          <Pressable onPress={() => router.back()} hitSlop={10} style={{ zIndex: 1 }}>
            <Ionicons name="chevron-back" size={26} color={Colors.text} />
          </Pressable>
          <Text
            style={{
              ...Typography.title,
              fontSize: FontSizes.h3,
              position: "absolute",
              left: 0,
              right: 0,
              textAlign: "center",
            }}
            pointerEvents="none"
          >
            {t("notifications")}
          </Text>
          <Pressable onPress={handleMarkAllRead} disabled={unreadCount === 0} hitSlop={10} style={{ zIndex: 1 }}>
            <Text
              style={{
                ...Typography.secondary,
                fontWeight: "700",
                color: unreadCount > 0 ? Colors.primary : Colors.textMuted,
              }}
            >
              {t("markAllRead")}
            </Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm }}>
          {filterOptions.map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => setFilter(opt.key)}
              style={{
                position: "relative",
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: Radius.pill,
                backgroundColor: filter === opt.key ? Colors.primary : Colors.card,
              }}
            >
              <Text
                style={{
                  fontSize: FontSizes.note,
                  fontWeight: "700",
                  color: filter === opt.key ? Colors.onPrimary : Colors.textMuted,
                }}
              >
                {t(opt.labelKey)}
              </Text>
              {opt.key === "unread" && unreadCount > 0 ? (
                <View
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    paddingHorizontal: 4,
                    backgroundColor: Colors.danger,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: Colors.bg,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700", lineHeight: 12 }}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: Spacing.xl }} color={Colors.primary} />
        ) : error ? (
          <Text style={{ color: Colors.danger, padding: Spacing.md }}>{error}</Text>
        ) : sections.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl }}>
            <Ionicons name="notifications-off-outline" size={40} color={Colors.textMuted} />
            <Text style={{ ...Typography.section, marginTop: Spacing.md }}>{t("noNotificationsYet")}</Text>
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4, textAlign: "center" }}>
              {t("noNotificationsYetSubtitle")}
            </Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderSectionHeader={({ section }) => (
              <View style={{ backgroundColor: Colors.bg, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: 4 }}>
                <Text
                  style={{
                    color: Colors.textMuted,
                    fontSize: FontSizes.tiny,
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {section.title}
                </Text>
              </View>
            )}
            renderItem={({ item }) => (
              <NotificationRow
                log={item}
                student={studentById.get(item.studentId)}
                onPress={() => handleOpen(item)}
                t={t}
                locale={locale}
              />
            )}
            ItemSeparatorComponent={() => (
              <View style={{ height: 1, backgroundColor: Colors.border, marginLeft: Spacing.md + 40 + Spacing.sm }} />
            )}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            contentContainerStyle={{ paddingBottom: Spacing.xl }}
          />
        )}
      </View>
    </ScreenLayout>
  );
}
