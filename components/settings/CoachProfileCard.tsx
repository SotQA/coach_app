import { ActivityIndicator, Platform, Text, View } from "react-native";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { PrimaryButton } from "../PrimaryButton";

const cardShadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
  },
  default: { elevation: 4 },
});

type Props = {
  fullName: string;
  email: string;
  roleLabel: string;
  initials: string;
  studentCount: number | null;
  statsLoading: boolean;
  onEditProfile: () => void;
};

export function CoachProfileCard({
  fullName,
  email,
  roleLabel,
  initials,
  studentCount,
  statsLoading,
  onEditProfile,
}: Props) {
  return (
    <View
      style={[
        {
          backgroundColor: Colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: Colors.border,
          padding: Spacing.md,
          marginBottom: Spacing.md,
          ...cardShadow,
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.md }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: Colors.surface,
            borderWidth: 2,
            borderColor: Colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 26, fontWeight: "900", color: Colors.primary }}>{initials}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...Typography.title, fontSize: 22 }} numberOfLines={2}>
            {fullName}
          </Text>
          <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }} numberOfLines={1}>
            {email || "—"}
          </Text>
          <Text style={{ ...Typography.secondary, color: Colors.primary, marginTop: 6, fontWeight: "700" }}>
            {roleLabel}
          </Text>
          {statsLoading ? (
            <View style={{ marginTop: 8 }}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : studentCount != null ? (
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 6 }}>
              {studentCount} {studentCount === 1 ? "student" : "students"} on your roster
            </Text>
          ) : null}
        </View>
      </View>
      <PrimaryButton title="Edit Profile" onPress={onEditProfile} />
    </View>
  );
}
