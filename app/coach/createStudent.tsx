import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { studentService } from "../../services/studentService";
import { PrimaryButton } from "../../components/PrimaryButton";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";
import { ScreenLayout } from "../../components/ScreenLayout";

// Screen used by the coach to create a new student record
// that will appear in their dashboard.
export default function CreateStudent() {
  const router = useRouter();
  const { user } = useAuth();
  const [studentEmail, setStudentEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!user || user.role !== "coach") {
        setError("You must be logged in as a coach.");
        return;
      }

      const email = studentEmail.trim();

      if (!email) {
        setError("Enter a student email.");
        return;
      }

      await studentService.assignStudentToCoachByEmail(email, user.id);

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
        contentContainerStyle={{
          flexGrow: 1,
          padding: Spacing.md,
          paddingBottom: Spacing.screenBottom,
          backgroundColor: Colors.bg,
        }}
        // Prevent iOS bounce/overscroll revealing white during swipe-back.
        bounces={false}
        alwaysBounceVertical={false}
        // Prevent Android glow/overscroll.
        overScrollMode="never"
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
              fontSize: FontSizes.h3,
              marginBottom: Spacing.xs,
            }}
          >
            Create Student
          </Text>
          <Text style={{ ...Typography.secondary, marginBottom: Spacing.md }}>
            Link an existing student account to your roster.
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
          <Text style={{ ...Typography.secondary, marginBottom: Spacing.md }}>
            The student must have already signed up with this email.
          </Text>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 12 }} />
          ) : (
            <>
              <PrimaryButton title="Link Student" onPress={handleCreate} />
              <View style={{ marginTop: Spacing.sm }}>
                <PrimaryButton
                  title="Cancel"
                  onPress={() => router.back()}
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



