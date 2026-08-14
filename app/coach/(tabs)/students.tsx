import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../context/AuthContext";
import { useI18n } from "../../../context/I18nContext";
import { studentService } from "../../../services/studentService";
import { trainingGroupService } from "../../../services/trainingGroupService";
import type { StudentSummary } from "../../../types/StudentSummary";
import { Avatar } from "../../../components/Avatar";
import { NotificationBellButton } from "../../../components/NotificationBellButton";
import { StudentCard } from "../../../components/StudentCard";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { Colors } from "../../../theme/colors";
import { Radius, Spacing } from "../../../theme/spacing";
import { Typography, FontSizes } from "../../../theme/typography";
import { ScreenLayout } from "../../../components/ScreenLayout";
import { logger } from "@/utils/logger";

export default function CoachStudents() {
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [query, setQuery] = useState("");
  const [latestGroupByStudentId, setLatestGroupByStudentId] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const fullName = `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim().toLowerCase();
      const email = (s.email ?? "").trim().toLowerCase();
      return (fullName && fullName.includes(q)) || (email && email.includes(q));
    });
  }, [students, query]);

  const coachInitials = useMemo(() => {
    const a = user?.firstName?.trim()?.[0] ?? "";
    const b = user?.lastName?.trim()?.[0] ?? "";
    const s = `${a}${b}`.toUpperCase();
    return s || "C";
  }, [user?.firstName, user?.lastName]);

  useEffect(() => {
    if (!user || user.role !== "coach") {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      logger.log("[coach/students] load start");
      setLoading(true);
      try {
        setError(null);
        logger.log("[coach/students] currentUser.id", user.id);
        const data = await studentService.getStudentsForCoach(user.id);
        logger.log("[coach/students] students", data.length);
        setStudents(data);

        // Fetch latest training group for each student (fast UI: list renders immediately).
        const nextMap: Record<string, string | null> = {};
        const concurrency = 8;
        let idx = 0;
        const worker = async () => {
          while (idx < data.length) {
            const i = idx++;
            const s = data[i];
            try {
              const g = await trainingGroupService.getLatestTrainingGroupForStudent(user.id, s.id);
              nextMap[s.id] = g?.name?.trim() ? g.name.trim() : null;
            } catch {
              nextMap[s.id] = null;
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(concurrency, data.length) }, worker));
        setLatestGroupByStudentId(nextMap);
      } catch (e: any) {
        console.error("[coach/students] load error", e);
        setError(e.message ?? t("failedToLoadStudents"));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  if (loading) {
    return (
      <ScreenLayout>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
          <ActivityIndicator />
        </View>
      </ScreenLayout>
    );
  }

  if (error) {
    return (
      <ScreenLayout>
        <View style={{ flex: 1, justifyContent: "center", padding: 16, backgroundColor: Colors.bg }}>
          <Text style={{ color: Colors.danger, marginBottom: Spacing.xs }}>{error}</Text>
          <PrimaryButton title={t("goToLogin")} onPress={() => router.replace("/login")} />
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: Spacing.md,
            paddingBottom: Spacing.lg,
            paddingTop: Spacing.lg,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: Spacing.md,
              marginBottom: Spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: Colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: Spacing.sm }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("openProfileSettingsA11y")}
                onPress={() => router.push("/coach/profile")}
                style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
              >
                <Avatar
                  photoURL={user?.photoURL}
                  initials={coachInitials}
                  size={52}
                  backgroundColor={Colors.surface}
                  textColor={Colors.text}
                  borderColor={Colors.primary}
                  borderWidth={2}
                />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={{ ...Typography.title, fontSize: FontSizes.h3 }}>{t("students")}</Text>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>
                  {t("activeStudents", { n: students.length })}
                </Text>
              </View>
            </View>
            <NotificationBellButton />
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: Spacing.sm,
              backgroundColor: Colors.card,
              borderRadius: Radius.lg,
              borderWidth: 1,
              borderColor: Colors.border,
              paddingHorizontal: Spacing.sm,
              paddingVertical: 12,
              marginBottom: Spacing.md,
            }}
          >
            <Ionicons name="search" size={18} color={Colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("searchStudents")}
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              style={{
                flex: 1,
                ...Typography.section,
                fontWeight: "600",
                paddingVertical: 0,
              }}
            />
            {query.trim() ? (
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} onPress={() => setQuery("")} />
            ) : null}
          </View>

          {students.length === 0 ? (
            <View
              style={{
                backgroundColor: Colors.card,
                borderRadius: Radius.md,
                padding: Spacing.md,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <Text style={Typography.secondary}>
                {t("noStudentsYetLong")}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredStudents}
              scrollEnabled={false}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <StudentCard
                  student={item}
                  actionTitle={t("planWorkout")}
                  secondaryActionTitle={t("viewProfile")}
                  currentSplitName={latestGroupByStudentId[item.id] ?? null}
                  onSecondaryPress={() =>
                    router.push({
                      pathname: "/coach/studentDetails",
                      params: { studentId: item.id },
                    })
                  }
                  onPress={() =>
                    router.push({
                      pathname: "/coach/createWorkoutPlan",
                      params: {
                        studentId: item.id,
                        studentName: [item.firstName, item.lastName].filter(Boolean).join(" ").trim() || t("roleStudent"),
                      },
                    })
                  }
                />
              )}
            />
          )}
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}



