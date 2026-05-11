import { ActivityIndicator, Platform, Text, View } from "react-native";
import { Avatar } from "../Avatar";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";
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
  onEditProfile: () => void;
  /** When true, shows a small loader under the role line instead of meta text. */
  statsLoading?: boolean;
  /** Optional line under role (e.g. roster count or workout summary). */
  metaLine?: string | null;
  /** Profile photo URL. When present, displays instead of the initials circle. */
  photoURL?: string | null;
};

export function SettingsProfileCard({
  fullName,
  email,
  roleLabel,
  initials,
  onEditProfile,
  statsLoading = false,
  metaLine = null,
  photoURL = null,
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
        <Avatar
          photoURL={photoURL}
          initials={initials}
          size={72}
          backgroundColor={Colors.surface}
          textColor={Colors.primary}
          borderColor={Colors.primary}
          borderWidth={2}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...Typography.title, fontSize: FontSizes.h3 }} numberOfLines={2}>
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
          ) : metaLine ? (
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 6 }}>{metaLine}</Text>
          ) : null}
        </View>
      </View>
      <PrimaryButton title="Edit Profile" onPress={onEditProfile} />
    </View>
  );
}
