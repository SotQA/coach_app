import { Pressable, Text, View } from "react-native";
import { Radius, Spacing } from "../../theme/spacing";
import { Colors } from "../../theme/colors";

const WHATSAPP_GREEN = "#25D366";

export type ContactButtonVariant = "telegram" | "whatsapp" | "disabled";

interface ContactButtonProps {
  variant: ContactButtonVariant;
  title: string;
  subtitle: string;
  onPress?: () => void;
}

const VARIANT_STYLES: Record<ContactButtonVariant, { bg: string; border: string; accent: string; icon: string }> = {
  telegram: { bg: "#1A2200", border: Colors.primary, accent: Colors.primary, icon: "✈️" },
  whatsapp: { bg: "#0D2010", border: WHATSAPP_GREEN, accent: WHATSAPP_GREEN, icon: "📱" },
  disabled: { bg: "#1A1A1A", border: "#333", accent: "#555", icon: "💬" },
};

export function ContactButton({ variant, title, subtitle, onPress }: ContactButtonProps) {
  const s = VARIANT_STYLES[variant];
  const isDisabled = variant === "disabled" || !onPress;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={{
        backgroundColor: s.bg,
        borderWidth: 1.5,
        borderColor: s.border,
        borderRadius: Radius.md,
        padding: Spacing.sm + 2,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: Spacing.sm,
      }}
    >
      <Text style={{ fontSize: 20, opacity: variant === "disabled" ? 0.3 : 1 }}>{s.icon}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: s.accent, fontSize: 13, fontWeight: "700" }}>{title}</Text>
        <Text
          style={{ color: variant === "disabled" ? "#FF9500" : Colors.textMuted, fontSize: 11, marginTop: 1 }}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>
      {!isDisabled ? <Text style={{ color: s.accent, fontSize: 16 }}>›</Text> : null}
    </Pressable>
  );
}
