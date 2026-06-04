import React, { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StrengthSparkRow } from "../StrengthSparkRow";
import type { StrengthRow } from "../../../hooks/useStudentProgress";
import { Colors } from "../../../theme/colors";
import { Radius, Spacing } from "../../../theme/spacing";
import { FontSizes, Typography } from "../../../theme/typography";
import { useI18n } from "../../../context/I18nContext";

interface StrengthSparklinesSectionProps {
  rows: StrengthRow[];
  hasMore: boolean;
  allRows: StrengthRow[];
  onSelectExercise?: (exerciseName: string) => void;
}

function StrengthSparklinesSectionInner({
  rows,
  hasMore,
  allRows,
  onSelectExercise,
}: StrengthSparklinesSectionProps) {
  const { t } = useI18n();
  const [showAll, setShowAll] = useState(false);

  if (rows.length === 0) {
    return (
      <View
        style={{
          backgroundColor: Colors.card,
          borderRadius: Radius.md,
          padding: Spacing.md,
          marginBottom: Spacing.lg,
          alignItems: "center",
        }}
      >
        <Text style={{ ...Typography.section, textAlign: "center", marginBottom: 6 }}>
          {t("no_strength_data")}
        </Text>
        <Text style={{ ...Typography.secondary, color: Colors.textMuted, textAlign: "center", maxWidth: 280 }}>
          {t("strength_unlocks_at_two_sessions")}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: Spacing.lg }}>
      <View
        style={{
          backgroundColor: Colors.card,
          borderRadius: Radius.md,
          overflow: "hidden",
        }}
      >
        {rows.map((row) => (
          <StrengthSparkRow
            key={row.exerciseName}
            exerciseName={row.exerciseName}
            currentE1RM={row.currentE1RM}
            deltaKg={row.deltaKg}
            points={row.points}
            onPress={onSelectExercise ? () => onSelectExercise(row.exerciseName) : undefined}
          />
        ))}

        {hasMore && (
          <Pressable
            onPress={() => setShowAll(true)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: Spacing.md,
              paddingVertical: Spacing.sm,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontSize: FontSizes.caption, color: Colors.primary, fontWeight: "700" }}>
              {t("show_all_exercises", { count: allRows.length })}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          </Pressable>
        )}
      </View>

      <Modal visible={showAll} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: Colors.bg }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: Spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: Colors.hairline,
            }}
          >
            <Text style={{ ...Typography.section }}>{t("show_all_exercises", { count: allRows.length })}</Text>
            <Pressable onPress={() => setShowAll(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          </View>
          <ScrollView>
            {allRows.map((row) => (
              <StrengthSparkRow
                key={row.exerciseName}
                exerciseName={row.exerciseName}
                currentE1RM={row.currentE1RM}
                deltaKg={row.deltaKg}
                points={row.points}
                onPress={
                  onSelectExercise
                    ? () => {
                        setShowAll(false);
                        onSelectExercise(row.exerciseName);
                      }
                    : undefined
                }
              />
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

export const StrengthSparklinesSection = React.memo(StrengthSparklinesSectionInner);
