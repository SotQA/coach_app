import { View, Text } from "react-native";
import { ScreenLayout } from "../../../components/ScreenLayout";
import { Colors } from "../../../theme/colors";
import { Radius, Spacing } from "../../../theme/spacing";
import { Typography } from "../../../theme/typography";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { useAuth } from "../../../context/AuthContext";

export default function CoachProfile() {
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <ScreenLayout>
      <View style={{ flex: 1, backgroundColor: Colors.bg, padding: Spacing.md }}>
        <Text style={{ ...Typography.title, fontSize: 22, marginBottom: Spacing.sm }}>Profile</Text>
        <View
          style={{
            backgroundColor: Colors.card,
            borderRadius: Radius.md,
            padding: Spacing.md,
            borderWidth: 1,
            borderColor: Colors.border,
          }}
        >
          <Text style={Typography.secondary}>Full name</Text>
          <Text style={{ ...Typography.section, marginBottom: Spacing.sm }}>
            {user.firstName || user.lastName ? `${user.firstName} ${user.lastName}`.trim() : "—"}
          </Text>

          <Text style={Typography.secondary}>Email</Text>
          <Text style={{ ...Typography.section, marginBottom: Spacing.sm }}>{user.email ?? "—"}</Text>

          <Text style={Typography.secondary}>Role</Text>
          <Text style={{ ...Typography.section, marginBottom: Spacing.sm }}>{user.role ?? "—"}</Text>

          <Text style={Typography.secondary}>Date of birth</Text>
          <Text style={{ ...Typography.section, marginBottom: Spacing.sm }}>{user.dateOfBirth ?? "—"}</Text>

          <Text style={Typography.secondary}>Sex</Text>
          <Text style={Typography.section}>
            {user.sex ? String(user.sex).charAt(0).toUpperCase() + String(user.sex).slice(1) : "—"}
          </Text>
        </View>

        <View style={{ marginTop: Spacing.lg }}>
          <PrimaryButton
            title="Logout"
            onPress={() => logout()}
            style={{ width: "auto", backgroundColor: Colors.border, alignSelf: "flex-start" }}
            textStyle={{ fontSize: 14, fontWeight: "700" }}
          />
        </View>
      </View>
    </ScreenLayout>
  );
}
