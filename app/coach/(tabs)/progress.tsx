import { View, Text } from "react-native";
import { Colors } from "../../../theme/colors";
import { Radius, Spacing } from "../../../theme/spacing";
import { Typography } from "../../../theme/typography";
import { ScreenLayout } from "../../../components/ScreenLayout";

export default function CoachProgressTab() {
  return (
    <ScreenLayout>
      <View style={{ flex: 1, backgroundColor: Colors.bg, padding: Spacing.md }}>
        <View
          style={{
            backgroundColor: Colors.card,
            borderRadius: Radius.lg,
            padding: Spacing.lg,
            borderWidth: 1,
            borderColor: Colors.border,
          }}
        >
          <Text style={Typography.title}>Progress</Text>
          <Text style={{ ...Typography.secondary, marginTop: Spacing.sm }}>
            Coach progress insights will appear here.
          </Text>
        </View>
      </View>
    </ScreenLayout>
  );
}
