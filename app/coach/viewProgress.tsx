import { useMemo } from "react";
import { View, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { PrimaryButton } from "../../components/PrimaryButton";

export default function ViewProgress() {
  const router = useRouter();
  const params = useLocalSearchParams<{ studentId?: string }>();
  const studentId = useMemo(() => String(params.studentId ?? "").trim(), [params]);

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 16, backgroundColor: "#0F172A" }}>
      <Text style={{ color: "#F9FAFB", fontSize: 20, fontWeight: "700", marginBottom: 8 }}>
        View Progress
      </Text>
      <Text style={{ color: "#9CA3AF", marginBottom: 16 }}>
        Progress tracking is coming next.
        {studentId ? `\n\nStudent UID: ${studentId}` : ""}
      </Text>
      <PrimaryButton title="Back" onPress={() => router.back()} />
    </View>
  );
}

