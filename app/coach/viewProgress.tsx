import { useMemo } from "react";
import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ScreenLayout } from "../../components/ScreenLayout";
import { BackButton } from "../../components/BackButton";
import { Colors } from "../../theme/colors";
import { Spacing } from "../../theme/spacing";

export default function ViewProgress() {
  const params = useLocalSearchParams<{ studentId?: string }>();
  const studentId = useMemo(() => String(params.studentId ?? "").trim(), [params]);

  return (
    <ScreenLayout>
      <View style={{ flex: 1, justifyContent: "center", padding: Spacing.md, backgroundColor: Colors.bg }}>
        <BackButton />
        <Text style={{ color: Colors.text, fontSize: 20, fontWeight: "700", marginBottom: 8 }}>
          View Progress
        </Text>
        <Text style={{ color: Colors.textSecondary, marginBottom: 16 }}>
          Progress tracking is coming next.
          {studentId ? `\n\nStudent UID: ${studentId}` : ""}
        </Text>
      </View>
    </ScreenLayout>
  );
}

