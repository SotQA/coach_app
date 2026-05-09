import type { ReactNode } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../theme/colors";
import { Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";

type Props = {
  label: string;
  value: string | null | undefined;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  right?: ReactNode;
  showDivider?: boolean;
};

export function InfoRow({ label, value, icon, right, showDivider = true }: Props) {
  const v = value && String(value).trim() ? String(value).trim() : "—";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        borderBottomWidth: showDivider ? 1 : 0,
        borderBottomColor: Colors.border,
        gap: Spacing.sm,
      }}
    >
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
        {icon ? (
          <View style={{ width: 22, alignItems: "center" }}>
            <Ionicons name={icon} size={18} color={Colors.textMuted} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontSize: FontSizes.caption }}>{label}</Text>
          <Text style={{ ...Typography.section, marginTop: 2 }}>{v}</Text>
        </View>
      </View>
      {right ? <View style={{ alignItems: "flex-end" }}>{right}</View> : null}
    </View>
  );
}



