import { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, SectionList, RefreshControl, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { studentService } from "../../services/studentService";
import { workoutService } from "../../services/workoutService";
import { inviteService } from "../../services/inviteService";
import type { StudentSummary } from "../../types/StudentSummary";
import type { WorkoutLog } from "../../types/Workout";
import type { Invite } from "../../types/Invite";
import { Avatar } from "../../components/Avatar";
import { ScreenLayout } from "../../components/ScreenLayout";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";
import { formatDateShort, formatRelativeTime } from "../../utils/formatLocale";
import { getUserInitials, getDisplayName } from "../../utils/userDisplay";
import { toMs } from "../../utils/dateConvert";

type FilterKey = "all" | "unread" | "read";

type FeedItem =
  | { kind: "workout"; id: string; ts: number; unread: boolean; log: WorkoutLog }
  | { kind: "invite"; id: string; ts: number; unread: boolean; invite: Invite };

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

function InviteBadge({ status, t }: { status: Invite["status"]; t: (k: string) => string }) {
  const config =
    status === "pending"
      ? { bg: Colors.warningTint, color: Colors.warning, label: t("inviteWaitingBadge") }
      : status === "accepted"
      ? { bg: Colors.primaryTint, color: Colors.primary, label: t("inviteAddedToRosterBadge") }
      : { bg: Colors.dangerTint, color: Colors.danger, label: t("inviteDeclinedBadge") };

  return (
    <View
      style={{
        backgroundColor: config.bg,
        borderRadius: Radius.sm,
        paddingHorizontal: 8,
        paddingVertical: 3,
        alignSelf: "flex-start",
        marginTop: 4,
      }}
    >
      <Text style={{ color: config.color, fontSize: FontSizes.tiny, fontWeight: "700" }}>{config.label}</Text>
    </View>
  );
}

function WorkoutNotificationRow({
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

function InviteNotificationRow({
  invite,
  student,
  onPress,
  t,
  locale,
}: {
  invite: Invite;
  student: StudentSummary | undefined;
  onPress: () => void;
  t: (k: string, o?: Record<string, unknown>) => string;
  locale: Parameters<typeof formatDateShort>[1];
}) {
  const isUnread = invite.coachNotificationRead === false;
  const initials = getUserInitials(student, "?");
  const name = getDisplayName(student, invite.studentEmail || "Student");
  const ms = invite.status === "pending" ? toMs(invite.createdAt) : toMs(invite.respondedAt) || toMs(invite.createdAt);
  const bodyText =
    invite.status === "pending"
      ? t("invitePendingTitle")
      : invite.status === "accepted"
      ? t("inviteAcceptedNotifText")
      : t("inviteDeclinedNotifText");

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
        <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>{bodyText}</Text>
        <InviteBadge status={invite.status} t={t} />
        <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontSize: FontSizes.tiny, marginTop: 4 }}>
          {ms ? formatRelativeTime(ms, t, locale) : ""}
        </Text>
      </View>
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
  const [invites, setInvites] = useState<Invite[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!user || user.role !== "coach") return;
    setError(null);
    try {
      const [studentList, notifLogs, notifInvites] = await Promise.all([
        studentService.getStudentsForCoach(user.id),
        workoutService.getNotificationLogsForCoach(user.id),
        inviteService.getInvitesForCoach(user.id),
      ]);

      // Invited students aren't on the roster until accepted, so pending/declined
      // invites need their own lookup to display a name + avatar.
      const rosterIds = new Set(studentList.map((s) => s.id));
      const missingIds = Array.from(new Set(notifInvites.map((i) => i.studentId).filter((id) => id && !rosterIds.has(id))));
      const extraStudents = await Promise.all(missingIds.map((id) => studentService.getUserSummaryById(id)));

      setStudents([...studentList, ...extraStudents.filter((s): s is StudentSummary => s !== null)]);
      setLogs(notifLogs);
      setInvites(notifInvites);
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

  const unreadCount = useMemo(
    () =>
      logs.filter((l) => l.notificationRead === false).length +
      invites.filter((i) => i.coachNotificationRead === false).length,
    [logs, invites]
  );

  const handleMarkAllRead = async () => {
    if (!user || unreadCount === 0) return;
    setLogs((prev) => prev.map((l) => ({ ...l, notificationRead: true })));
    setInvites((prev) => prev.map((i) => ({ ...i, coachNotificationRead: true })));
    try {
      await Promise.all([
        workoutService.markAllNotificationsRead(user.id),
        inviteService.markAllInviteNotificationsReadForCoach(user.id),
      ]);
    } catch {
      load();
    }
  };

  const handleOpenLog = (log: WorkoutLog) => {
    if (log.notificationRead === false) {
      setLogs((prev) => prev.map((l) => (l.id === log.id ? { ...l, notificationRead: true } : l)));
      workoutService.markNotificationRead(log.id).catch(() => {});
    }
    router.push({ pathname: "/coach/workoutComparison" as any, params: { logId: log.id } });
  };

  const handleOpenInvite = (invite: Invite) => {
    if (invite.coachNotificationRead === false) {
      setInvites((prev) => prev.map((i) => (i.id === invite.id ? { ...i, coachNotificationRead: true } : i)));
      inviteService.markInviteNotificationRead(invite.id, "coach").catch(() => {});
    }
  };

  const items = useMemo<FeedItem[]>(() => {
    const workoutItems: FeedItem[] = logs.map((log) => ({
      kind: "workout",
      id: `w_${log.id}`,
      ts: toMs(log.completedAt),
      unread: log.notificationRead === false,
      log,
    }));
    const inviteItems: FeedItem[] = invites.map((invite) => ({
      kind: "invite",
      id: `i_${invite.id}`,
      ts: invite.status === "pending" ? toMs(invite.createdAt) : toMs(invite.respondedAt) || toMs(invite.createdAt),
      unread: invite.coachNotificationRead === false,
      invite,
    }));
    return [...workoutItems, ...inviteItems].sort((a, b) => b.ts - a.ts);
  }, [logs, invites]);

  const scopedItems = useMemo(() => {
    if (!todayOnly) return items;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();
    return items.filter((i) => i.ts >= todayMs);
  }, [items, todayOnly]);

  const filteredItems = useMemo(() => {
    if (filter === "unread") return scopedItems.filter((i) => i.unread);
    if (filter === "read") return scopedItems.filter((i) => !i.unread);
    return scopedItems;
  }, [scopedItems, filter]);

  const sections = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const todayMs = todayStart.getTime();
    const yestMs = yesterdayStart.getTime();

    const groups = new Map<string, FeedItem[]>();
    const order: string[] = [];
    for (const item of filteredItems) {
      const key = item.ts >= todayMs ? t("today") : item.ts >= yestMs ? t("yesterday") : formatDateShort(item.ts, locale);
      if (!groups.has(key)) {
        groups.set(key, []);
        order.push(key);
      }
      groups.get(key)!.push(item);
    }
    return order.map((title) => ({ title, data: groups.get(title)! }));
  }, [filteredItems, locale, t]);

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
            flexDirection: "row",
            alignItems: "center",
            gap: Spacing.sm,
            paddingHorizontal: Spacing.md,
            paddingTop: Spacing.sm,
            paddingBottom: Spacing.xs,
          }}
        >
          <View style={{ width: 96, alignItems: "flex-start" }}>
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Ionicons name="chevron-back" size={26} color={Colors.text} />
            </Pressable>
          </View>
          <Text
            style={{
              ...Typography.title,
              fontSize: FontSizes.h3,
              flex: 1,
              textAlign: "center",
            }}
            numberOfLines={1}
          >
            {t("notifications")}
          </Text>
          <Pressable onPress={handleMarkAllRead} disabled={unreadCount === 0} hitSlop={10} style={{ width: 96, alignItems: "flex-end" }}>
            <Text
              numberOfLines={2}
              style={{
                ...Typography.secondary,
                fontWeight: "700",
                textAlign: "right",
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
            renderItem={({ item }) =>
              item.kind === "workout" ? (
                <WorkoutNotificationRow
                  log={item.log}
                  student={studentById.get(item.log.studentId)}
                  onPress={() => handleOpenLog(item.log)}
                  t={t}
                  locale={locale}
                />
              ) : (
                <InviteNotificationRow
                  invite={item.invite}
                  student={studentById.get(item.invite.studentId)}
                  onPress={() => handleOpenInvite(item.invite)}
                  t={t}
                  locale={locale}
                />
              )
            }
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
