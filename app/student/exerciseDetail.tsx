import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getExerciseById, getExerciseName } from "../../services/localExerciseService";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";

export default function ExerciseDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    exerciseName: string;
    exerciseDbId?: string;
    videoUrl?: string;
    coachNote?: string;
    lang?: string;
  }>();

  const lang = (params.lang as "en" | "ru" | "pl") ?? "en";
  const localExercise = params.exerciseDbId ? getExerciseById(params.exerciseDbId) : null;
  const displayName = localExercise
    ? getExerciseName(localExercise, lang)
    : params.exerciseName;

  const handleVideo = () => {
    if (params.videoUrl) {
      Linking.openURL(params.videoUrl);
    } else {
      Linking.openURL(
        "https://www.youtube.com/results?search_query=" +
          encodeURIComponent((params.exerciseName ?? "") + " exercise tutorial")
      );
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>{displayName}</Text>
      </View>

      {/* No local data note */}
      {!localExercise && (
        <Text style={styles.mutedNote}>Exercise details not available for custom exercises</Text>
      )}

      {/* Muscles */}
      {localExercise && (
        <View style={styles.section}>
          {localExercise.primaryMuscles.length > 0 && (
            <View style={styles.chipRow}>
              <Text style={styles.sectionLabel}>Primary</Text>
              {localExercise.primaryMuscles.map(m => (
                <View key={m} style={styles.chipPrimary}>
                  <Text style={styles.chipText}>{capitalize(m)}</Text>
                </View>
              ))}
            </View>
          )}
          {localExercise.secondaryMuscles.length > 0 && (
            <View style={styles.chipRow}>
              <Text style={styles.sectionLabel}>Secondary</Text>
              {localExercise.secondaryMuscles.map(m => (
                <View key={m} style={styles.chipSecondary}>
                  <Text style={styles.chipTextMuted}>{capitalize(m)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Meta */}
      {localExercise && (
        <View style={styles.chipRow}>
          {localExercise.equipment && <View style={styles.chipMeta}><Text style={styles.chipTextMuted}>{capitalize(localExercise.equipment)}</Text></View>}
          {localExercise.level && <View style={styles.chipMeta}><Text style={styles.chipTextMuted}>{capitalize(localExercise.level)}</Text></View>}
          {localExercise.category && <View style={styles.chipMeta}><Text style={styles.chipTextMuted}>{capitalize(localExercise.category)}</Text></View>}
        </View>
      )}

      {/* Video */}
      <View style={styles.section}>
        <Pressable style={params.videoUrl ? styles.btnPrimary : styles.btnOutlined} onPress={handleVideo}>
          <Text style={params.videoUrl ? styles.btnPrimaryText : styles.btnOutlinedText}>
            {params.videoUrl ? "▶ Watch Tutorial" : "Search on YouTube"}
          </Text>
        </Pressable>
        {params.videoUrl && (
          <Text style={styles.urlText} numberOfLines={1}>{params.videoUrl}</Text>
        )}
      </View>

      {/* Coach Notes */}
      {!!params.coachNote && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Coach Notes</Text>
          <Text style={styles.noteText}>{params.coachNote}</Text>
        </View>
      )}

      {/* Instructions */}
      {localExercise && localExercise.instructions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>How to perform</Text>
          {localExercise.instructions.map((step, i) => (
            <View key={i} style={styles.instructionRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNum}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Spacing.md, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.md, gap: 12 },
  backButton: { padding: 4 },
  backText: { fontSize: 16, color: Colors.primary },
  title: { ...Typography.section, fontWeight: "900", fontSize: 20, flex: 1 },
  section: { marginVertical: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginVertical: 4 },
  sectionLabel: { ...Typography.secondary, fontWeight: "600", color: Colors.textMuted, marginRight: 4, marginBottom: 4 },
  chipPrimary: { backgroundColor: Colors.surface, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.primary },
  chipSecondary: { backgroundColor: Colors.surface, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  chipMeta: { backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: Colors.border },
  chipText: { fontSize: 13, color: Colors.primary, fontWeight: "600" },
  chipTextMuted: { fontSize: 12, color: Colors.textMuted },
  btnPrimary: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 14, alignItems: "center" },
  btnPrimaryText: { color: Colors.onPrimary, fontSize: 16, fontWeight: "600" },
  btnOutlined: { borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 14, alignItems: "center" },
  btnOutlinedText: { color: Colors.primary, fontSize: 16, fontWeight: "600" },
  urlText: { ...Typography.secondary, fontSize: 11, color: Colors.textMuted, marginTop: 4, textAlign: "center" },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, marginVertical: 8, borderWidth: 1, borderColor: Colors.border },
  noteText: { ...Typography.body, color: Colors.text, marginTop: 4, lineHeight: 20 },
  instructionRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginVertical: 6 },
  stepBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  stepNum: { color: Colors.onPrimary, fontSize: 13, fontWeight: "700" },
  stepText: { flex: 1, ...Typography.body, color: Colors.text, lineHeight: 20 },
  mutedNote: { ...Typography.secondary, color: Colors.textMuted, marginBottom: 12 },
});
