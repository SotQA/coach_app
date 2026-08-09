import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { workoutService } from "../../services/workoutService";
import { studentService } from "../../services/studentService";
import type { WorkoutPlanChange, FieldDiff } from "../../types/Workout";
import type { StudentSummary } from "../../types/StudentSummary";
import { ScreenLayout } from "../../components/ScreenLayout";
import { PrimaryButton } from "../../components/PrimaryButton";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";
import { getDisplayName } from "../../utils/userDisplay";
import { formatRelativeTime } from "../../utils/formatLocale";
import { toMs } from "../../utils/dateConvert";

function fieldLabel(field: string, t: (k: string) => string): string {
  switch (field) {
    case "name":
      return t("exerciseFieldName");
    case "sets":
      return t("exerciseFieldSets");
    case "reps":
      return t("exerciseFieldReps");
    case "weight":
      return t("exerciseFieldWeight");
    case "rest":
      return t("exerciseFieldRest");
    case "tempo":
      return t("exerciseFieldTempo");
    case "rpe":
      return t("exerciseFieldRpe");
    default:
      return field;
  }
}

function formatFieldValue(field: string, raw: string): string {
  if (raw.trim() === "") return "—";
  if (field === "rest") return `${raw}s`;
  if (field === "weight") return `${raw}kg`;
  return raw;
}

function DiffLine({ field, diff, t }: { field: string; diff: FieldDiff; t: (k: string) => string }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 6, marginTop: 4 }}>
      <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>{fieldLabel(field, t)}</Text>
      <Text style={{ ...Typography.secondary, color: "#777", textDecorationLine: "line-through" }}>
        {formatFieldValue(field, diff.from)}
      </Text>
      <Text style={{ color: "#666" }}>→</Text>
      <Text style={{ ...Typography.secondary, color: Colors.primary, fontWeight: "800" }}>
        {formatFieldValue(field, diff.to)}
      </Text>
    </View>
  );
}

function Tag({ label, tone }: { label: string; tone: "add" | "rem" | "mod" }) {
  const bg =
    tone === "add" ? "rgba(52,199,89,0.16)" : tone === "rem" ? "rgba(255,69,58,0.16)" : "rgba(245,158,11,0.16)";
  const fg = tone === "add" ? "#5FDB84" : tone === "rem" ? "#FF6B62" : Colors.warning;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: "flex-start" }}>
      <Text style={{ color: fg, fontSize: 10, fontWeight: "800", letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
      }}
    >
      {children}
    </View>
  );
}

export default function WorkoutPlanChangeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const params = useLocalSearchParams<{ changeId?: string }>();
  const changeId = useMemo(() => String(params.changeId ?? "").trim(), [params.changeId]);

  const [change, setChange] = useState<WorkoutPlanChange | null>(null);
  const [coach, setCoach] = useState<StudentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!changeId) throw new Error("Missing changeId.");
        if (!user || user.role !== "student") throw new Error(t("failedToLoad"));

        const found = await workoutService.getWorkoutPlanChangeById(changeId);
        if (!found || found.studentId !== user.id) throw new Error(t("failedToLoad"));
        setChange(found);

        if (found.studentNotificationRead === false) {
          workoutService.markChangeRead(changeId).catch(() => {});
        }

        if (found.coachId) {
          const c = await studentService.getUserSummaryById(found.coachId).catch(() => null);
          setCoach(c);
        }
      } catch (e: any) {
        setError(e?.message ?? t("failedToLoad"));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [changeId, user?.id, user?.role, t]);

  const coachName = getDisplayName(coach, t("coachFallbackName"));
  const changedMs = change ? toMs(change.changedAt) : 0;

  return (
    <ScreenLayout>
      <View
        style={{
          position: "relative",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: Spacing.md,
          paddingTop: Spacing.sm,
          paddingBottom: Spacing.xs,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ position: "absolute", left: Spacing.md, zIndex: 1 }}>
          <Ionicons name="chevron-back" size={26} color={Colors.text} />
        </Pressable>
        <Text style={{ ...Typography.title, fontSize: FontSizes.h3 }} numberOfLines={1}>
          {change?.planNameSnapshot ?? t("loading")}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: Spacing.xl }} color={Colors.primary} />
      ) : error || !change ? (
        <Text style={{ color: Colors.danger, padding: Spacing.md }}>{error ?? t("failedToLoad")}</Text>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.xl }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: Spacing.sm }}>
            <View
              style={{
                backgroundColor: change.type === "deleted" ? "rgba(255,69,58,0.16)" : "rgba(212,255,68,0.16)",
                borderRadius: 6,
                paddingHorizontal: 9,
                paddingVertical: 4,
              }}
            >
              <Text
                style={{
                  color: change.type === "deleted" ? "#FF6B62" : Colors.primary,
                  fontSize: 11,
                  fontWeight: "800",
                  letterSpacing: 0.4,
                }}
              >
                {change.type === "deleted" ? t("removedBadge") : t("updatedBadge")}
              </Text>
            </View>
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontSize: FontSizes.tiny }}>
              {t("changedByLine", { name: coachName, when: changedMs ? formatRelativeTime(changedMs, t, locale) : "" })}
            </Text>
          </View>

          {change.coachMessage ? (
            <View
              style={{
                backgroundColor: Colors.surface,
                borderLeftWidth: 3,
                borderLeftColor: Colors.primary,
                borderRadius: 10,
                padding: Spacing.sm,
                marginBottom: Spacing.md,
              }}
            >
              <Text style={{ ...Typography.body, fontStyle: "italic", color: "#D8D8DC" }}>
                &ldquo;{change.coachMessage}&rdquo;
              </Text>
              <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontSize: FontSizes.tiny, marginTop: 6, fontWeight: "700" }}>
                — {coachName}
              </Text>
            </View>
          ) : null}

          {change.type === "updated" ? (
            <>
              {(change.diff?.exercisesChanged?.length ?? 0) > 0 ? (
                <>
                  <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontSize: FontSizes.tiny, fontWeight: "700", textTransform: "uppercase", marginBottom: 6 }}>
                    {t("exercisesChanged")}
                  </Text>
                  {change.diff!.exercisesChanged!.map((ex) => {
                    const noteChange = ex.fields.coachNote;
                    const videoChange = ex.fields.videoUrl;
                    const scalarFields = Object.entries(ex.fields).filter(
                      ([f]) => f !== "coachNote" && f !== "videoUrl"
                    );
                    return (
                      <Card key={ex.id}>
                        <Text style={{ ...Typography.section, fontWeight: "800", marginBottom: scalarFields.length ? 2 : 0 }}>
                          {ex.name}
                        </Text>
                        {scalarFields.map(([field, diff]) => (
                          <DiffLine key={field} field={field} diff={diff} t={t} />
                        ))}
                        {noteChange ? (
                          <View style={{ marginTop: 8 }}>
                            <Tag label={t("noteChangedTag")} tone="mod" />
                            {noteChange.to.trim() ? (
                              <Text style={{ ...Typography.secondary, color: "#B8B8BE", marginTop: 6 }}>
                                &ldquo;{noteChange.to}&rdquo;
                              </Text>
                            ) : null}
                          </View>
                        ) : null}
                        {videoChange ? (
                          <View style={{ marginTop: 8 }}>
                            <Tag label={t("videoChangedTag")} tone="mod" />
                          </View>
                        ) : null}
                      </Card>
                    );
                  })}
                </>
              ) : null}

              {(change.diff?.exercisesAdded?.length ?? 0) > 0 ? (
                <>
                  <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontSize: FontSizes.tiny, fontWeight: "700", textTransform: "uppercase", marginTop: Spacing.sm, marginBottom: 6 }}>
                    {t("exercisesAdded")}
                  </Text>
                  {change.diff!.exercisesAdded!.map((ex) => (
                    <Card key={ex.id}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View>
                          <Text style={{ ...Typography.section, fontWeight: "800" }}>{ex.name}</Text>
                          {ex.sets || ex.reps ? (
                            <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>
                              {[ex.sets ? `${ex.sets}` : null, ex.reps].filter(Boolean).join(" x ")}
                            </Text>
                          ) : null}
                        </View>
                        <Tag label={t("addedTag")} tone="add" />
                      </View>
                    </Card>
                  ))}
                </>
              ) : null}

              {(change.diff?.exercisesRemoved?.length ?? 0) > 0 ? (
                <>
                  <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontSize: FontSizes.tiny, fontWeight: "700", textTransform: "uppercase", marginTop: Spacing.sm, marginBottom: 6 }}>
                    {t("exercisesRemoved")}
                  </Text>
                  {change.diff!.exercisesRemoved!.map((ex) => (
                    <Card key={ex.id}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View>
                          <Text style={{ ...Typography.section, fontWeight: "800", color: Colors.textMuted, textDecorationLine: "line-through" }}>
                            {ex.name}
                          </Text>
                          {ex.sets || ex.reps ? (
                            <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>
                              {[ex.sets ? `${ex.sets}` : null, ex.reps].filter(Boolean).join(" x ")}
                            </Text>
                          ) : null}
                        </View>
                        <Tag label={t("removedTag")} tone="rem" />
                      </View>
                    </Card>
                  ))}
                </>
              ) : null}

              <View style={{ marginTop: Spacing.md }}>
                <PrimaryButton
                  title={t("viewFullWorkout")}
                  onPress={() => router.push({ pathname: "/student/workoutPlanDetail" as any, params: { workoutPlanId: change.planId } })}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontSize: FontSizes.tiny, fontWeight: "700", textTransform: "uppercase", marginBottom: 6 }}>
                {t("whatWasRemoved")}
              </Text>
              <Card>
                {(change.planSnapshot?.exercises ?? []).map((ex, i) => (
                  <View key={ex.id ?? i} style={{ marginBottom: i === (change.planSnapshot?.exercises.length ?? 1) - 1 ? 0 : 10 }}>
                    <Text style={{ ...Typography.section, fontWeight: "800" }}>{ex.name}</Text>
                    <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>
                      {[ex.sets ? `${ex.sets}` : null, ex.reps].filter(Boolean).join(" x ")}
                    </Text>
                  </View>
                ))}
              </Card>
              <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontSize: FontSizes.tiny, textAlign: "center", marginTop: 6 }}>
                {t("archivedSnapshotHint")}
              </Text>
            </>
          )}
        </ScrollView>
      )}
    </ScreenLayout>
  );
}
