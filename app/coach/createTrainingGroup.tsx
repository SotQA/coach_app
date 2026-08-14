import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { trainingGroupService } from "../../services/trainingGroupService";
import type { TrainingGroupType } from "../../types/TrainingGroup";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenLayout } from "../../components/ScreenLayout";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";

// Chip display label only — the underlying TrainingGroupType value (persisted as
// the group's `name` when not "Custom") is never translated, only how it's shown here.
const TYPE_LABEL_KEYS: Record<TrainingGroupType, string> = {
  "Full Body": "groupTypeFullBody",
  "Upper / Lower": "groupTypeUpperLower",
  PPL: "groupTypePpl",
  "Strength Block": "groupTypeStrength",
  Hypertrophy: "groupTypeHypertrophy",
  Deload: "groupTypeDeload",
  Conditioning: "groupTypeConditioning",
  Custom: "groupTypeCustom",
};

export default function CreateTrainingGroup() {
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ studentId?: string; studentName?: string }>();
  const studentId = useMemo(() => String(params.studentId ?? "").trim(), [params.studentId]);
  const studentName = useMemo(() => String(params.studentName ?? t("roleStudent")), [params.studentName, t]);
  const typeLabel = (type: TrainingGroupType): string => t(TYPE_LABEL_KEYS[type] ?? "groupTypeCustom");

  const [type, setType] = useState<TrainingGroupType>("PPL");
  const [customName, setCustomName] = useState("");
  const [workoutsPerWeek, setWorkoutsPerWeek] = useState("4");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedName = useMemo(() => {
    if (type !== "Custom") return String(type);
    return customName.trim();
  }, [type, customName]);

  const canCreate = Boolean(studentId) && Boolean(user?.id) && Boolean(resolvedName) && !loading;

  const types: TrainingGroupType[] = [
    "Full Body",
    "Upper / Lower",
    "PPL",
    "Strength Block",
    "Hypertrophy",
    "Deload",
    "Conditioning",
    "Custom",
  ];

  return (
    <ScreenLayout>
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.bg }}
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.lg, paddingTop: Spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ ...Typography.title, fontSize: FontSizes.h2, marginBottom: 6 }}>{t("createTrainingGroupTitle")}</Text>
        <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.md }}>
          {t("forStudentLabel", { name: studentName })}
        </Text>

        <View
          style={{
            backgroundColor: Colors.card,
            borderRadius: Radius.lg,
            padding: Spacing.md,
            borderWidth: 1,
            borderColor: Colors.border,
            marginBottom: Spacing.md,
          }}
        >
          <Text style={{ ...Typography.section, marginBottom: Spacing.sm }}>{t("typeFieldLabel")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs }}>
            {types.map((t) => {
              const active = t === type;
              return (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  style={({ pressed }) => ({
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: Radius.pill,
                    backgroundColor: active ? Colors.primary : Colors.surface,
                    borderWidth: 1,
                    borderColor: active ? Colors.primary : Colors.border,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={{ ...Typography.secondary, color: active ? Colors.onPrimary : Colors.text }}>
                    {typeLabel(t)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {type === "Custom" ? (
            <View style={{ marginTop: Spacing.md }}>
              <Text style={{ ...Typography.secondary, marginBottom: 6 }}>{t("groupNameLabel")}</Text>
              <TextInput
                value={customName}
                onChangeText={setCustomName}
                placeholder={t("groupNamePlaceholder")}
                placeholderTextColor={Colors.textMuted}
                style={{
                  borderWidth: 1,
                  borderColor: Colors.border,
                  padding: 12,
                  borderRadius: Radius.sm,
                  color: Colors.text,
                  backgroundColor: Colors.surface,
                }}
              />
            </View>
          ) : null}

          <View style={{ marginTop: Spacing.md }}>
            <Text style={{ ...Typography.secondary, marginBottom: 6 }}>{t("workoutsPerWeekLabel")}</Text>
            <TextInput
              value={workoutsPerWeek}
              onChangeText={setWorkoutsPerWeek}
              placeholder="4"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              style={{
                borderWidth: 1,
                borderColor: Colors.border,
                padding: 12,
                borderRadius: Radius.sm,
                color: Colors.text,
                backgroundColor: Colors.surface,
              }}
            />
          </View>
        </View>

        {error ? (
          <Text style={{ ...Typography.secondary, color: Colors.danger, marginBottom: Spacing.sm }}>
            {error}
          </Text>
        ) : null}

        <PrimaryButton
          title={loading ? t("creatingEllipsis") : t("createGroupButton")}
          disabled={!canCreate}
          onPress={async () => {
            try {
              setError(null);
              setLoading(true);
              if (!user || user.role !== "coach") throw new Error(t("mustBeLoggedInAsCoachError"));
              if (!studentId) throw new Error(t("missingStudentContextError"));
              const wpw = Number(workoutsPerWeek);
              const created = await trainingGroupService.createTrainingGroup({
                coachId: user.id,
                studentId,
                type,
                name: resolvedName,
                workoutsPerWeek: Number.isFinite(wpw) ? wpw : 4,
              });

              // Return to select screen and auto-select the newly created group.
              router.replace({
                pathname: "/coach/selectTrainingGroup",
                params: { studentId, studentName, selectedGroupId: created.id },
              });
            } catch (e: any) {
              setError(e?.message ?? t("failedToCreateGroupError"));
            } finally {
              setLoading(false);
            }
          }}
        />
      </ScrollView>
    </ScreenLayout>
  );
}



