import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { studentService } from "../../services/studentService";
import { workoutService } from "../../services/workoutService";
import type { StudentSummary } from "../../types/StudentSummary";
import type { LoggedSet, WorkoutLog } from "../../types/Workout";
import { Avatar } from "../../components/Avatar";
import { ScreenLayout } from "../../components/ScreenLayout";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";
import { formatDateShort } from "../../utils/formatLocale";
import { getUserInitials, getDisplayName } from "../../utils/userDisplay";
import { toMs } from "../../utils/dateConvert";
import { normalizeExerciseName } from "../../utils/workoutMetrics";
import type { SupportedLocale } from "../../context/I18nContext";

function findPreviousLog(history: WorkoutLog[], anchor: WorkoutLog): WorkoutLog | null {
  const targetName = normalizeExerciseName(anchor.workoutName);
  const anchorMs = toMs(anchor.completedAt);
  let best: WorkoutLog | null = null;
  let bestMs = -Infinity;
  for (const log of history) {
    if (log.id === anchor.id) continue;
    if (normalizeExerciseName(log.workoutName) !== targetName) continue;
    const ms = toMs(log.completedAt);
    if (ms < anchorMs && ms > bestMs) {
      best = log;
      bestMs = ms;
    }
  }
  return best;
}

function setLabel(set: LoggedSet): string {
  if (!set || set.reps <= 0) return "—";
  return set.weight != null ? `${set.reps} × ${set.weight} kg` : `${set.reps} reps`;
}

function isImproved(set: LoggedSet | undefined, prevSet: LoggedSet | undefined): boolean {
  if (!set || !prevSet) return false;
  if (set.weight == null || prevSet.weight == null) return false;
  if (set.weight > prevSet.weight) return true;
  if (set.weight === prevSet.weight && set.reps > prevSet.reps) return true;
  return false;
}

function completedWhenLabel(ms: number, t: (k: string) => string, locale: SupportedLocale): string {
  if (!ms) return "";
  const d = new Date(ms);
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  if (ms >= todayStart.getTime()) return `${t("today")} · ${time}`;
  const yestStart = new Date(todayStart);
  yestStart.setDate(yestStart.getDate() - 1);
  if (ms >= yestStart.getTime()) return `${t("yesterday")} · ${time}`;
  return `${formatDateShort(ms, locale)} · ${time}`;
}

function SetPill({ label, improved, muted }: { label: string; improved?: boolean; muted?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: improved ? "rgba(212,255,68,0.15)" : Colors.surface,
        borderRadius: Radius.sm,
        paddingVertical: 5,
        paddingHorizontal: 8,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontSize: FontSizes.caption,
          fontWeight: improved ? "700" : "500",
          color: improved ? Colors.primary : muted ? Colors.textMuted : Colors.text,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

type ExerciseRowData = {
  name: string;
  latestSets: LoggedSet[];
  prevSets: LoggedSet[] | null;
};

function ExerciseRow({ row, hasPrevious }: { row: ExerciseRowData; hasPrevious: boolean }) {
  return (
    <View
      style={{
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderColor: Colors.border,
      }}
    >
      <Text style={{ ...Typography.section, fontSize: FontSizes.note, fontWeight: "700", marginBottom: 6 }}>
        {row.name}
      </Text>
      <View style={{ flexDirection: "row", gap: Spacing.sm }}>
        <View style={{ flex: 1, gap: 4 }}>
          {row.latestSets.map((s, i) => (
            <SetPill key={i} label={setLabel(s)} improved={hasPrevious && isImproved(s, row.prevSets?.[i])} />
          ))}
        </View>
        {hasPrevious ? (
          <View style={{ flex: 1, gap: 4 }}>
            {row.prevSets && row.prevSets.length > 0 ? (
              row.prevSets.map((s, i) => <SetPill key={i} label={setLabel(s)} muted />)
            ) : (
              <SetPill label="—" muted />
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function WorkoutComparison() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const params = useLocalSearchParams<{ logId?: string }>();
  const logId = useMemo(() => String(params.logId ?? "").trim(), [params]);

  const [log, setLog] = useState<WorkoutLog | null>(null);
  const [student, setStudent] = useState<StudentSummary | null>(null);
  const [previous, setPrevious] = useState<WorkoutLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!logId) {
          setError("Missing workout log.");
          return;
        }
        if (!user || user.role !== "coach") {
          setError("You must be logged in as a coach.");
          return;
        }
        const anchor = await workoutService.getWorkoutLogById(logId);
        if (!anchor) {
          setError("Workout log not found.");
          return;
        }
        const [studentDoc, history] = await Promise.all([
          studentService.getStudentById(anchor.studentId),
          workoutService.getWorkoutHistory(anchor.studentId),
        ]);
        setLog(anchor);
        setStudent(studentDoc);
        setPrevious(findPreviousLog(history, anchor));
      } catch (e: any) {
        setError(e?.message ?? "Failed to load workout.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [logId, user?.id, user?.role]);

  const rows: ExerciseRowData[] = useMemo(() => {
    if (!log) return [];
    const prevByName = new Map<string, LoggedSet[]>();
    if (previous) {
      for (const ex of previous.exercises) {
        prevByName.set(normalizeExerciseName(ex.name), ex.sets);
      }
    }
    return log.exercises.map((ex) => ({
      name: ex.name,
      latestSets: ex.sets,
      prevSets: previous ? prevByName.get(normalizeExerciseName(ex.name)) ?? null : null,
    }));
  }, [log, previous]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (error || !log) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: Spacing.md, backgroundColor: Colors.bg }}>
        <Text style={{ color: Colors.danger }}>{error ?? "Workout not found."}</Text>
      </View>
    );
  }

  const latestMs = toMs(log.completedAt);
  const prevMs = previous ? toMs(previous.completedAt) : 0;

  return (
    <ScreenLayout>
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        {/* Fixed header block — deliberately outside any scroll container so it stays put
            while only the (potentially long) exercise list below scrolls. */}
        <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xs }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={{ flexDirection: "row", alignItems: "center", gap: 2, marginBottom: Spacing.sm }}
          >
            <Ionicons name="chevron-back" size={18} color={Colors.primary} />
            <Text style={{ color: Colors.primary, fontWeight: "700", fontSize: FontSizes.note }}>
              {t("notifications")}
            </Text>
          </Pressable>

          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
            <Avatar
              photoURL={student?.photoURL}
              initials={getUserInitials(student, "?")}
              size={48}
              backgroundColor={Colors.surface}
              textColor={Colors.text}
              borderColor={Colors.primary}
              borderWidth={2}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ ...Typography.title, fontSize: FontSizes.subheading }}>
                {getDisplayName(student, "Student")}
              </Text>
              <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>{log.workoutName}</Text>
              <Text style={{ color: Colors.primary, fontSize: FontSizes.tiny, fontWeight: "600", marginTop: 2 }}>
                {completedWhenLabel(latestMs, t, locale)}
              </Text>
            </View>
          </View>

          {previous ? (
            <View
              style={{
                flexDirection: "row",
                gap: Spacing.sm,
                paddingTop: Spacing.md,
                paddingBottom: Spacing.xs,
                borderBottomWidth: 1,
                borderColor: Colors.border,
                marginTop: Spacing.xs,
              }}
            >
              <Text
                style={{
                  flex: 1,
                  textAlign: "center",
                  color: Colors.primary,
                  fontWeight: "700",
                  fontSize: FontSizes.tiny,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                }}
              >
                {t("latestLabel")} · {formatDateShort(latestMs, locale)}
              </Text>
              <Text
                style={{
                  flex: 1,
                  textAlign: "center",
                  color: Colors.textMuted,
                  fontWeight: "700",
                  fontSize: FontSizes.tiny,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                }}
              >
                {t("previousLabel")} · {formatDateShort(prevMs, locale)}
              </Text>
            </View>
          ) : (
            <Text
              style={{
                ...Typography.secondary,
                color: Colors.textMuted,
                fontStyle: "italic",
                marginTop: Spacing.sm,
              }}
            >
              {t("noPreviousSession")}
            </Text>
          )}
        </View>

        <FlatList
          style={{ flex: 1 }}
          data={rows}
          keyExtractor={(item, i) => `${item.name}-${i}`}
          renderItem={({ item }) => <ExerciseRow row={item} hasPrevious={!!previous} />}
          contentContainerStyle={{ paddingBottom: Spacing.md }}
        />

        {previous ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: Spacing.xs,
              padding: Spacing.md,
              borderTopWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary }} />
            <Text style={{ color: Colors.textMuted, fontSize: FontSizes.caption }}>{t("improvedLegend")}</Text>
          </View>
        ) : null}
      </View>
    </ScreenLayout>
  );
}
