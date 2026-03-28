import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenLayout } from "../../components/ScreenLayout";
import { useAuth } from "../../context/AuthContext";
import { workoutService } from "../../services/workoutService";
import type { WorkoutLog } from "../../types/Workout";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { formatLogWhen } from "../../utils/formatLogWhen";

export default function WorkoutLogFeedback() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ logId?: string }>();
  const logId = useMemo(() => String(params.logId ?? "").trim(), [params]);

  const [log, setLog] = useState<WorkoutLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [coachId, setCoachId] = useState<string | null>(null);

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
        setCoachId(user.id);
        const doc = await workoutService.getWorkoutLogById(logId);
        if (!doc) {
          setError("Workout log not found.");
          return;
        }
        setLog(doc);
        setFeedback(doc.coachFeedback?.trim() ?? "");
      } catch (e: any) {
        setError(e?.message ?? "Failed to load log.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [logId, user?.id, user?.role]);

  const handleSave = async () => {
    if (!coachId || !logId) return;
    const text = feedback.trim();
    if (!text) {
      setError("Please enter feedback for your athlete.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await workoutService.updateWorkoutLogFeedback(logId, coachId, text);
      router.back();
    } catch (e: any) {
      setError(e?.message ?? "Could not save feedback.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error && !log) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: Spacing.md, backgroundColor: Colors.bg }}>
        <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>{error}</Text>
        <PrimaryButton title="Back" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScreenLayout>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: Colors.bg }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.xl }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ ...Typography.title, fontSize: 22, marginBottom: Spacing.xs }}>
            Workout feedback
          </Text>
          <Text style={{ ...Typography.secondary, marginBottom: Spacing.md }}>
            {log?.workoutName ?? "Workout"} · {formatLogWhen(log?.completedAt ?? (log as any)?.date)}
          </Text>

          <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Your message</Text>
          <TextInput
            value={feedback}
            onChangeText={setFeedback}
            placeholder="Technique notes, encouragement, or next-session cues…"
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={2000}
            style={{
              borderWidth: 1,
              borderColor: Colors.border,
              borderRadius: Radius.md,
              padding: 12,
              minHeight: 160,
              textAlignVertical: "top",
              color: Colors.text,
              backgroundColor: Colors.surface,
              marginBottom: Spacing.sm,
            }}
          />
          <Text style={{ ...Typography.secondary, fontSize: 12, marginBottom: Spacing.md }}>
            {feedback.trim().length}/2000
          </Text>

          {error ? (
            <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>{error}</Text>
          ) : null}

          {saving ? (
            <ActivityIndicator />
          ) : (
            <PrimaryButton title="Save feedback" onPress={handleSave} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
}
