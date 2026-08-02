import { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, SectionList, RefreshControl, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { studentService } from "../../services/studentService";
import { inviteService } from "../../services/inviteService";
import type { StudentSummary } from "../../types/StudentSummary";
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

/**
 * Splits the localized "X wants to add you..." string around the coach's name so
 * it can be highlighted, mirroring CompletedLine in the coach notifications screen.
 */
function InviteText({ coachName, t }: { coachName: string; t: (k: string, o?: Record<string, unknown>) => string }) {
  const full = t("coachInviteText", { name: coachName });
  const idx = full.indexOf(coachName);
  if (idx === -1) {
    return <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>{full}</Text>;
  }
  const before = full.slice(0, idx);
  const after = full.slice(idx + coachName.length);
  return (
    <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>
      {before}
      <Text style={{ color: Colors.primary, fontWeight: "700" }}>{coachName}</Text>
      {after}
    </Text>
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
        photoURL={coach?.photoURL}
        initials={initials}
        size={40}
        backgroundColor={Colors.surface}
        textColor={Colors.text}
        borderColor={Colors.primary}
        borderWidth={2}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...Typography.section, fontSize: FontSizes.note, fontWeight: "700" }}>
          {t("coachInviteTitle")}
        </Text>
        <InviteText coachName={coachName} t={t} />

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

export default function StudentNotifications() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { t, locale } = useI18n();

  const [coaches, setCoaches] = useState<StudentSummary[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
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
      const inviteList = await inviteService.getInvitesForStudent(user.id);
      const coachIds = Array.from(new Set(inviteList.map((i) => i.coachId).filter(Boolean)));
      const coachList = await Promise.all(coachIds.map((id) => studentService.getUserSummaryById(id)));
      setInvites(inviteList);
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

  const unreadCount = useMemo(() => invites.filter((i) => i.studentNotificationRead === false).length, [invites]);

  const handleMarkAllRead = async () => {
    if (!user || unreadCount === 0) return;
    setInvites((prev) => prev.map((i) => ({ ...i, studentNotificationRead: true })));
    try {
      await inviteService.markAllInviteNotificationsReadForStudent(user.id);
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

  const filteredInvites = useMemo(() => {
    if (filter === "unread") return invites.filter((i) => i.studentNotificationRead === false);
    if (filter === "read") return invites.filter((i) => i.studentNotificationRead !== false);
    return invites;
  }, [invites, filter]);

  const sections = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const todayMs = todayStart.getTime();
    const yestMs = yesterdayStart.getTime();

    const groups = new Map<string, Invite[]>();
    const order: string[] = [];
    for (const invite of filteredInvites) {
      const ms = toMs(invite.createdAt);
      const key = ms >= todayMs ? t("today") : ms >= yestMs ? t("yesterday") : formatDateShort(ms, locale);
      if (!groups.has(key)) {
        groups.set(key, []);
        order.push(key);
      }
      groups.get(key)!.push(invite);
    }
    return order.map((title) => ({ title, data: groups.get(title)! }));
  }, [filteredInvites, locale, t]);

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
            renderItem={({ item }) => (
              <InviteRow
                invite={item}
                coach={coachById.get(item.coachId)}
                responding={respondingId === item.id}
                onRespond={(response) => handleRespond(item, response)}
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
