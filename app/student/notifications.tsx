import { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, SectionList, RefreshControl, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { studentService } from "../../services/studentService";
import { inviteService } from "../../services/inviteService";
import { workoutService } from "../../services/workoutService";
import type { StudentSummary } from "../../types/StudentSummary";
import type { Invite } from "../../types/Invite";
import type { WorkoutPlan, WorkoutPlanChange } from "../../types/Workout";
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
  | { kind: "invite"; id: string; ts: number; unread: boolean; invite: Invite }
  | { kind: "workoutPlan"; id: string; ts: number; unread: boolean; plan: WorkoutPlan }
  | { kind: "planChange"; id: string; ts: number; unread: boolean; change: WorkoutPlanChange };

/**
 * Splits a localized string around a literal substring (typically a coach's
 * name) so it can be highlighted, without assuming any particular word order
 * (safe across en/pl/ru phrasing).
 */
function HighlightText({ full, highlight, color }: { full: string; highlight: string; color: string }) {
  const idx = highlight ? full.indexOf(highlight) : -1;
  if (idx === -1) {
    return <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>{full}</Text>;
  }
  const before = full.slice(0, idx);
  const after = full.slice(idx + highlight.length);
  return (
    <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>
      {before}
      <Text style={{ color, fontWeight: "700" }}>{highlight}</Text>
      {after}
    </Text>
  );
}

function NotificationAvatar({
  photoURL,
  initials,
  unread,
}: {
  photoURL?: string | null;
  initials: string;
  unread: boolean;
}) {
  return (
    <View>
      {unread ? (
        <View
          style={{
            position: "absolute",
            left: -6,
            top: 12,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: Colors.primary,
          }}
        />
      ) : null}
      <Avatar
        photoURL={photoURL}
        initials={initials}
        size={40}
        backgroundColor={Colors.surface}
        textColor={Colors.text}
        borderColor={Colors.primary}
        borderWidth={2}
      />
    </View>
  );
}

function InviteRow({
  invite,
  coach,
  responding,
  onRespond,
  t,
  locale,
}: {
  invite: Invite;
  coach: StudentSummary | undefined;
  responding: boolean;
  onRespond: (response: "accepted" | "declined") => void;
  t: (k: string, o?: Record<string, unknown>) => string;
  locale: Parameters<typeof formatDateShort>[1];
}) {
  const isUnread = invite.studentNotificationRead === false;
  const initials = getUserInitials(coach, "?");
  const coachName = getDisplayName(coach, "Coach");
  const ms = toMs(invite.createdAt);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: Spacing.sm,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        backgroundColor: isUnread ? Colors.surface : "transparent",
      }}
    >
      <NotificationAvatar photoURL={coach?.photoURL} initials={initials} unread={isUnread} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...Typography.section, fontSize: FontSizes.note, fontWeight: "700" }}>
          {t("coachInviteTitle")}
        </Text>
        <HighlightText full={t("coachInviteText", { name: coachName })} highlight={coachName} color={Colors.primary} />

        {invite.status === "pending" ? (
          responding ? (
            <ActivityIndicator style={{ alignSelf: "flex-start", marginTop: 8 }} color={Colors.primary} />
          ) : (
            <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
              <Pressable
                onPress={() => onRespond("accepted")}
                style={({ pressed }) => ({
                  backgroundColor: Colors.primary,
                  borderRadius: Radius.sm,
                  paddingVertical: 6,
                  paddingHorizontal: 14,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ color: Colors.onPrimary, fontSize: FontSizes.tiny, fontWeight: "800" }}>
                  {t("acceptInvite")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onRespond("declined")}
                style={({ pressed }) => ({
                  backgroundColor: Colors.surface,
                  borderRadius: Radius.sm,
                  paddingVertical: 6,
                  paddingHorizontal: 14,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ color: Colors.textMuted, fontSize: FontSizes.tiny, fontWeight: "700" }}>
                  {t("declineInvite")}
                </Text>
              </Pressable>
            </View>
          )
        ) : (
          <Text
            style={{
              color: invite.status === "accepted" ? Colors.primary : Colors.textMuted,
              fontSize: FontSizes.tiny,
              fontWeight: "700",
              marginTop: 8,
            }}
          >
            {invite.status === "accepted" ? t("inviteAccepted") : t("inviteDeclined")}
          </Text>
        )}

        <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontSize: FontSizes.tiny, marginTop: 6 }}>
          {ms ? formatRelativeTime(ms, t, locale) : ""}
        </Text>
      </View>
    </View>
  );
}

function WorkoutPlanRow({
  plan,
  coach,
  onPress,
  t,
  locale,
}: {
  plan: WorkoutPlan;
  coach: StudentSummary | undefined;
  onPress: () => void;
  t: (k: string, o?: Record<string, unknown>) => string;
  locale: Parameters<typeof formatDateShort>[1];
}) {
  const isUnread = plan.studentNotificationRead === false;
  const initials = getUserInitials(coach, "?");
  const coachName = getDisplayName(coach, "Coach");
  const ms = toMs(plan.createdAt);

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
      <NotificationAvatar photoURL={coach?.photoURL} initials={initials} unread={isUnread} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...Typography.section, fontSize: FontSizes.note, fontWeight: "700" }}>
          {t("newWorkoutNotifTitle")}
        </Text>
        <HighlightText
          full={t("newWorkoutNotifText", { name: coachName, workout: plan.name })}
          highlight={coachName}
          color={Colors.primary}
        />
        {plan.groupName ? (
          <View
            style={{
              backgroundColor: Colors.primaryTint,
              borderRadius: Radius.sm,
              paddingHorizontal: 8,
              paddingVertical: 3,
              alignSelf: "flex-start",
              marginTop: 4,
            }}
          >
            <Text style={{ color: Colors.primary, fontSize: FontSizes.tiny, fontWeight: "700" }}>
              {plan.groupName}
            </Text>
          </View>
        ) : null}
        <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontSize: FontSizes.tiny, marginTop: 6 }}>
          {ms ? formatRelativeTime(ms, t, locale) : ""}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={{ alignSelf: "center" }} />
    </Pressable>
  );
}

function PlanChangeRow({
  change,
  coach,
  onPress,
  t,
  locale,
}: {
  change: WorkoutPlanChange;
  coach: StudentSummary | undefined;
  onPress: () => void;
  t: (k: string, o?: Record<string, unknown>) => string;
  locale: Parameters<typeof formatDateShort>[1];
}) {
  const isUnread = change.studentNotificationRead === false;
  const coachName = getDisplayName(coach, "Coach");
  const ms = toMs(change.changedAt);
  const isDeleted = change.type === "deleted";

  const title = isDeleted ? t("workoutRemovedNotifTitle") : t("workoutUpdatedNotifTitle");
  const bodyText = t(isDeleted ? "workoutRemovedNotifText" : "workoutUpdatedNotifText", {
    name: coachName,
    workout: change.planNameSnapshot,
  });

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
      <View>
        {isUnread ? (
          <View
            style={{
              position: "absolute",
              left: -6,
              top: 12,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: Colors.primary,
            }}
          />
        ) : null}
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isDeleted ? "rgba(255,69,58,0.14)" : "rgba(212,255,68,0.14)",
          }}
        >
          <Ionicons name={isDeleted ? "trash-outline" : "create-outline"} size={18} color={isDeleted ? "#FF6B62" : Colors.primary} />
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...Typography.section, fontSize: FontSizes.note, fontWeight: "700" }}>{title}</Text>
        <HighlightText full={bodyText} highlight={coachName} color={isDeleted ? "#FF6B62" : Colors.primary} />
        <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontSize: FontSizes.tiny, marginTop: 6 }}>
          {ms ? formatRelativeTime(ms, t, locale) : ""}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={{ alignSelf: "center" }} />
    </Pressable>
  );
}

export default function StudentNotifications() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { t, locale } = useI18n();

  const [coaches, setCoaches] = useState<StudentSummary[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [changes, setChanges] = useState<WorkoutPlanChange[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!user || user.role !== "student") return;
    setError(null);
    try {
      const [inviteList, planList, changeList] = await Promise.all([
        inviteService.getInvitesForStudent(user.id),
        workoutService.getNotificationPlansForStudent(user.id),
        workoutService.getWorkoutPlanChangesForStudent(user.id),
      ]);
      const coachIds = Array.from(
        new Set(
          [...inviteList.map((i) => i.coachId), ...planList.map((p) => p.coachId), ...changeList.map((c) => c.coachId)].filter(
            Boolean
          )
        )
      );
      const coachList = await Promise.all(coachIds.map((id) => studentService.getUserSummaryById(id)));
      setInvites(inviteList);
      setPlans(planList);
      setChanges(changeList);
      setCoaches(coachList.filter((c): c is StudentSummary => c !== null));
    } catch (e: any) {
      setError(e?.message ?? t("failedToLoad"));
    }
  }, [user?.id, user?.role, t]);

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

  const coachById = useMemo(() => {
    const map = new Map<string, StudentSummary>();
    for (const c of coaches) map.set(c.id, c);
    return map;
  }, [coaches]);

  const unreadCount = useMemo(
    () =>
      invites.filter((i) => i.studentNotificationRead === false).length +
      plans.filter((p) => p.studentNotificationRead === false).length +
      changes.filter((c) => c.studentNotificationRead === false).length,
    [invites, plans, changes]
  );

  const handleMarkAllRead = async () => {
    if (!user || unreadCount === 0) return;
    setInvites((prev) => prev.map((i) => ({ ...i, studentNotificationRead: true })));
    setPlans((prev) => prev.map((p) => ({ ...p, studentNotificationRead: true })));
    setChanges((prev) => prev.map((c) => ({ ...c, studentNotificationRead: true })));
    try {
      await Promise.all([
        inviteService.markAllInviteNotificationsReadForStudent(user.id),
        workoutService.markAllPlanNotificationsReadForStudent(user.id),
        workoutService.markAllChangesReadForStudent(user.id),
      ]);
    } catch {
      load();
    }
  };

  const handleRespond = async (invite: Invite, response: "accepted" | "declined") => {
    if (!user) return;
    setRespondingId(invite.id);
    try {
      await inviteService.respondToInvite(invite.id, user.id, response);
      setInvites((prev) =>
        prev.map((i) => (i.id === invite.id ? { ...i, status: response, studentNotificationRead: true } : i))
      );
      if (response === "accepted") await refreshUser();
    } catch (e: any) {
      setError(e?.message ?? t("inviteRespondFailed"));
    } finally {
      setRespondingId(null);
    }
  };

  const handleOpenPlan = (plan: WorkoutPlan) => {
    if (plan.studentNotificationRead === false) {
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, studentNotificationRead: true } : p)));
      workoutService.markPlanNotificationRead(plan.id).catch(() => {});
    }
    router.push({ pathname: "/student/workoutPlanDetail" as any, params: { workoutPlanId: plan.id } });
  };

  const handleOpenChange = (change: WorkoutPlanChange) => {
    if (change.studentNotificationRead === false) {
      setChanges((prev) => prev.map((c) => (c.id === change.id ? { ...c, studentNotificationRead: true } : c)));
      workoutService.markChangeRead(change.id).catch(() => {});
    }
    router.push({ pathname: "/student/workoutPlanChange" as any, params: { changeId: change.id } });
  };

  const items = useMemo<FeedItem[]>(() => {
    const inviteItems: FeedItem[] = invites.map((invite) => ({
      kind: "invite",
      id: `i_${invite.id}`,
      ts: toMs(invite.createdAt),
      unread: invite.studentNotificationRead === false,
      invite,
    }));
    const planItems: FeedItem[] = plans.map((plan) => ({
      kind: "workoutPlan",
      id: `p_${plan.id}`,
      ts: toMs(plan.createdAt),
      unread: plan.studentNotificationRead === false,
      plan,
    }));
    const changeItems: FeedItem[] = changes.map((change) => ({
      kind: "planChange",
      id: `c_${change.id}`,
      ts: toMs(change.changedAt),
      unread: change.studentNotificationRead === false,
      change,
    }));
    return [...inviteItems, ...planItems, ...changeItems].sort((a, b) => b.ts - a.ts);
  }, [invites, plans, changes]);

  const filteredItems = useMemo(() => {
    if (filter === "unread") return items.filter((i) => i.unread);
    if (filter === "read") return items.filter((i) => !i.unread);
    return items;
  }, [items, filter]);

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
              {t("noNotificationsYetSubtitleStudent")}
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
              item.kind === "invite" ? (
                <InviteRow
                  invite={item.invite}
                  coach={coachById.get(item.invite.coachId)}
                  responding={respondingId === item.invite.id}
                  onRespond={(response) => handleRespond(item.invite, response)}
                  t={t}
                  locale={locale}
                />
              ) : item.kind === "workoutPlan" ? (
                <WorkoutPlanRow
                  plan={item.plan}
                  coach={coachById.get(item.plan.coachId)}
                  onPress={() => handleOpenPlan(item.plan)}
                  t={t}
                  locale={locale}
                />
              ) : (
                <PlanChangeRow
                  change={item.change}
                  coach={coachById.get(item.change.coachId)}
                  onPress={() => handleOpenChange(item.change)}
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
