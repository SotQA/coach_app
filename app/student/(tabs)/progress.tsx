import { View, Text } from "react-native";
import { Colors } from "../../../theme/colors";
import { Spacing } from "../../../theme/spacing";
import { Typography } from "../../../theme/typography";
import { ScreenLayout } from "../../../components/ScreenLayout";

export default function StudentProgress() {
  return (
    <ScreenLayout>
      <View style={{ flex: 1, backgroundColor: Colors.bg, padding: Spacing.md }}>
        <Text style={{ ...Typography.title, fontSize: 22, marginBottom: Spacing.sm }}>
          Progress
        </Text>
        <Text style={Typography.secondary}>Progress tracking is coming next.</Text>
      </View>
    </ScreenLayout>
  );
}

