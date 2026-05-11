import { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Avatar } from "../Avatar";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import type { TrainingGroup } from "../../types/TrainingGroup";

export interface StudentProfileHeroProps {
  displayName: string;
  email: string;
  initials: string;
  photoURL?: string | null;
  latestGroup: TrainingGroup | null;
  lastWorkoutLabel: string | null;
}

function StudentProfileHeroImpl({
  displayName,
  email,
  initials,
  photoURL,
  latestGroup,
  lastWorkoutLabel: lastLbl,
}: StudentProfileHeroProps) {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroRow}>
        <Avatar
          photoURL={photoURL}
          initials={initials}
          size={64}
          backgroundColor={Colors.surface}
          textColor={Colors.text}
          borderColor={Colors.primary}
          borderWidth={2}
        />
        <View style={styles.heroTextCol}>
          <Text style={styles.displayName}>{displayName}</Text>
          <Text style={styles.email}>{email}</Text>
          <View style={styles.chipsRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>
                {latestGroup?.name?.trim() ? latestGroup.name.trim() : "No active training split"}
              </Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipText}>
                {latestGroup?.workoutsPerWeek ? `${latestGroup.workoutsPerWeek} workouts/week` : "Workouts/week —"}
              </Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{lastLbl ? `Last workout: ${lastLbl}` : "Last workout: —"}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export const StudentProfileHero = memo(StudentProfileHeroImpl);

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  heroTextCol: { flex: 1 },
  displayName: { ...Typography.title, fontSize: 24 },
  email: { ...Typography.secondary, color: Colors.textMuted, marginTop: 6 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: Spacing.sm },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipText: { ...Typography.secondary, color: Colors.textMuted },
});
