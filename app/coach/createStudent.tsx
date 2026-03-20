import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { authService } from "../../services/authService";
import { studentService } from "../../services/studentService";
import { PrimaryButton } from "../../components/PrimaryButton";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { ScreenLayout } from "../../components/ScreenLayout";

// Screen used by the coach to create a new student record
// that will appear in their dashboard.
export default function CreateStudent() {
  const router = useRouter();
  const [studentUid, setStudentUid] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    setLoading(true);
    try {
      const user = await authService.getCurrentUserWithRole();
      if (!user || user.role !== "coach") {
        setError("You must be logged in as a coach.");
        return;
      }

      const uid = studentUid.trim();
      const email = studentEmail.trim();

      if (email) {
        await studentService.assignStudentToCoachByEmail(email, user.id);
      } else {
        if (!uid) {
          setError("Enter a student email or UID.");
          return;
        }
        await studentService.assignStudentToCoach(uid, user.id);
      }

      router.replace("/coach/dashboard");
    } catch (e: any) {
      setError(e.message ?? "Failed to create student.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenLayout>
      <KeyboardAwareScrollView
        style={{ flex: 1, backgroundColor: Colors.bg }}
        contentContainerStyle={{ flexGrow: 1, padding: Spacing.md, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        enableResetScrollToCoords={false}
        extraScrollHeight={24}
      >
      <View
        style={{
          backgroundColor: Colors.card,
          borderRadius: Radius.md,
          padding: 20,
          marginTop: Spacing.md,
          borderWidth: 1,
          borderColor: Colors.border,
        }}
      >
          <Text
            style={{
              ...Typography.title,
              fontSize: 22,
              marginBottom: Spacing.xs,
            }}
          >
            Create Student
          </Text>
          <Text style={{ ...Typography.secondary, marginBottom: Spacing.md }}>
            Link an existing student account to your roster using their Firebase Auth UID.
          </Text>
          <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Student Email</Text>
          <TextInput
            placeholder="student@example.com"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={studentEmail}
            onChangeText={setStudentEmail}
            style={{
              borderWidth: 1,
              borderColor: Colors.border,
              padding: 12,
              borderRadius: Radius.sm,
              marginBottom: Spacing.sm,
              color: Colors.text,
              backgroundColor: Colors.surface,
            }}
          />
          <Text style={{ ...Typography.secondary, marginBottom: Spacing.sm }}>
            Or link by UID below.
          </Text>
          <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Student UID</Text>
          <TextInput
            placeholder="Firebase Auth UID"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            value={studentUid}
            onChangeText={setStudentUid}
            style={{
              borderWidth: 1,
              borderColor: Colors.border,
              padding: 12,
              borderRadius: Radius.sm,
              marginBottom: Spacing.sm,
              color: Colors.text,
              backgroundColor: Colors.surface,
            }}
          />
          <Text style={{ ...Typography.secondary, marginBottom: Spacing.md }}>
            The student must have already signed up. This sets `users/{studentUid}.coachId` to you.
          </Text>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 12 }} />
          ) : (
            <>
              <PrimaryButton title="Link Student" onPress={handleCreate} />
              <View style={{ marginTop: Spacing.sm }}>
                <PrimaryButton
                  title="Back to Students"
                  onPress={() => router.replace("/coach/dashboard")}
                  style={{ backgroundColor: Colors.border }}
                />
              </View>
            </>
          )}
          {error ? (
            <Text style={{ color: Colors.danger, marginTop: Spacing.xs }}>{error}</Text>
          ) : null}
      </View>
      </KeyboardAwareScrollView>
    </ScreenLayout>
  );
}

