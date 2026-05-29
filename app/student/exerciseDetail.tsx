import { useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Linking,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getExerciseById, getExerciseName } from "../../services/localExerciseService";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";

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

  const { width } = useWindowDimensions();
  const playerWidth = width - Spacing.md * 2;
  const playerHeight = Math.round(playerWidth * 9 / 16);

  const videoUrl = params.videoUrl ?? "";
  const videoId = extractYouTubeId(videoUrl);
  const isYouTube = videoUrl ? isYouTubeUrl(videoUrl) : false;
  const isNonYouTubeLink = videoUrl && !isYouTube;

  const [thumbError, setThumbError] = useState(false);

  const openVideo = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
    } catch {
      // Fallback to external app if WebBrowser fails
      Linking.openURL(url);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}
    >
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity activeOpacity={0.6} onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>{displayName}</Text>
      </View>

      {/* No local data note */}
      {!localExercise && (
        <Text style={styles.mutedNote}>Exercise details not available for custom exercises</Text>
      )}

      {/* Primary muscles */}
      {localExercise && localExercise.primaryMuscles.length > 0 && (
        <View style={styles.muscleCard}>
          <Text style={styles.microLabel}>PRIMARY MUSCLES</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
            {localExercise.primaryMuscles.map(m => (
              <View key={m} style={styles.chipPrimary}>
                <Text style={styles.chipPrimaryText}>{capitalize(m)}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Secondary muscles */}
      {localExercise && localExercise.secondaryMuscles.length > 0 && (
        <View style={styles.muscleCard}>
          <Text style={styles.microLabel}>SECONDARY MUSCLES</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
            {localExercise.secondaryMuscles.map(m => (
              <View key={m} style={styles.chipSecondary}>
                <Text style={styles.chipSecondaryText}>{capitalize(m)}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Meta info row */}
      {localExercise && (
        <View style={styles.metaRow}>
          {localExercise.equipment && (
            <View style={styles.metaTile}>
              <Ionicons name="barbell-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.microLabel}>Equipment</Text>
              <Text style={styles.metaValue}>{capitalize(localExercise.equipment)}</Text>
            </View>
          )}
          {localExercise.level && (
            <View style={styles.metaTile}>
              <Ionicons name="speedometer-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.microLabel}>Level</Text>
              <Text style={styles.metaValue}>{capitalize(localExercise.level)}</Text>
            </View>
          )}
          {localExercise.category && (
            <View style={styles.metaTile}>
              <Ionicons name="grid-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.microLabel}>Category</Text>
              <Text style={styles.metaValue}>{capitalize(localExercise.category)}</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Video section ── */}

      {/* Case 1: YouTube URL — thumbnail preview + tap to play */}
      {videoId && (
        <View style={styles.videoCard}>
          <Text style={[styles.microLabel, { padding: Spacing.sm, paddingBottom: Spacing.xs }]}>
            TUTORIAL VIDEO
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => openVideo(videoUrl)}
            style={styles.thumbnailContainer}
          >
            {/* YouTube thumbnail — freely available for any video ID */}
            {!thumbError ? (
              <Image
                source={{ uri: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` }}
                style={styles.thumbnail}
                resizeMode="cover"
                onError={() => setThumbError(true)}
              />
            ) : (
              // Fallback if thumbnail fails (rare)
              <View style={[styles.thumbnail, styles.thumbnailFallback]}>
                <Ionicons name="logo-youtube" size={40} color={Colors.textMuted} />
              </View>
            )}
            {/* Dark overlay + play button */}
            <View style={styles.thumbnailOverlay}>
              <View style={styles.playButton}>
                <Ionicons name="play" size={28} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => openVideo(videoUrl)}
            style={styles.watchBtn}
          >
            <Ionicons name="logo-youtube" size={16} color="#FF0000" />
            <Text style={styles.watchBtnText}>Watch Tutorial</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Case 3: non-YouTube external link */}
      {isNonYouTubeLink && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => openVideo(videoUrl)}
          style={styles.btnPrimary}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="play-circle-outline" size={18} color="#fff" />
            <Text style={styles.btnPrimaryText}>Watch Tutorial</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Case 4: no video URL → YouTube search */}
      {!videoUrl && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() =>
            openVideo(
              "https://www.youtube.com/results?search_query=" +
                encodeURIComponent((params.exerciseName ?? "") + " exercise tutorial")
            )
          }
          style={styles.btnOutlined}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="search-outline" size={18} color={Colors.primary} />
            <Text style={styles.btnOutlinedText}>Search on YouTube</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Coach Notes */}
      {!!params.coachNote && (
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Ionicons name="person-circle-outline" size={16} color={Colors.primary} />
            <Text style={styles.sectionLabel}>Coach Notes</Text>
          </View>
          <Text style={styles.noteText}>{params.coachNote}</Text>
        </View>
      )}

      {/* Instructions */}
      {localExercise && localExercise.instructions.length > 0 && (
        <View style={styles.muscleCard}>
          <Text style={styles.microLabel}>HOW TO PERFORM</Text>
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

/**
 * Extracts the YouTube video ID from any YouTube URL format.
 * Handles: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, youtube.com/embed/
 * Returns null if the URL is not a recognised YouTube URL.
 */
function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return match?.[1] ?? null;
}

function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/.test(url);
}



const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Spacing.md, paddingBottom: 40 },
  headerContainer: { marginBottom: Spacing.md },
  backBtn: { alignSelf: "flex-start", marginBottom: Spacing.xs, padding: 4, marginLeft: -4 },
  screenTitle: { fontSize: 22, fontWeight: "900", color: Colors.text, textAlign: "center" },
  muscleCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  microLabel: { fontSize: 11, color: Colors.textMuted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 },
  chipPrimary: {
    backgroundColor: Colors.primary + "26",
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipPrimaryText: { fontSize: 13, color: Colors.primary, fontWeight: "600" },
  chipSecondary: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipSecondaryText: { fontSize: 12, color: Colors.textMuted },
  metaRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
  metaTile: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    gap: 4,
  },
  metaValue: { fontSize: 13, fontWeight: "600", color: Colors.text, textAlign: "center" },
  btnPrimary: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 14, alignItems: "center", marginBottom: Spacing.xs },
  btnPrimaryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  btnOutlined: { borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 14, alignItems: "center", marginBottom: Spacing.xs },
  btnOutlinedText: { color: Colors.primary, fontSize: 16, fontWeight: "600" },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: Colors.text },
  noteText: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  instructionRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginVertical: 6 },
  stepBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  stepNum: { color: "#fff", fontSize: 13, fontWeight: "700" },
  stepText: { flex: 1, fontSize: 14, color: Colors.text, lineHeight: 20 },
  mutedNote: { fontSize: 12, color: Colors.textMuted, marginBottom: Spacing.sm, textAlign: "center" },
  videoCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  thumbnailContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    position: "relative",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  thumbnailFallback: {
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 4, // optical centering for play icon
  },
  watchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  watchBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
});
