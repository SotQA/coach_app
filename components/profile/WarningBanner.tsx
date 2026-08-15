import { Pressable, Text, View } from "react-native";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";

interface WarningBannerProps {
  title: string;
  body: string;
  linkText?: string;
  onPressLink?: () => void;
}

export function WarningBanner({ title, body, linkText, onPressLink }: WarningBannerProps) {
  return (
    <View
      style={{
        backgroundColor: "#1A1200",
        borderWidth: 1,
        borderColor: "#FF9500",
        borderRadius: Radius.sm,
        padding: Spacing.sm,
        marginBottom: Spacing.sm,
        flexDirection: "row",
        gap: 8,
        alignItems: "flex-start",
      }}
    >
      <Text style={{ fontSize: 15, marginTop: 1 }}>⚠️</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#FF9500", fontSize: 12, fontWeight: "700", marginBottom: 2 }}>{title}</Text>
        <Text style={{ color: Colors.textMuted, fontSize: 11, lineHeight: 16 }}>{body}</Text>
        {linkText && onPressLink ? (
          <Pressable onPress={onPressLink} accessibilityRole="button" accessibilityLabel={linkText}>
            <Text style={{ color: Colors.primary, fontSize: 11, marginTop: 4, fontWeight: "600" }}>{linkText}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
