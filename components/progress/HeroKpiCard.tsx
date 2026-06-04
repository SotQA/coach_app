import React, { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { FontSizes, Typography } from "../../theme/typography";

interface HeroKpiCardProps {
  label: string;
  value: string;
  subtitle?: string | null;
  delta?: { value: string; direction: "up" | "down" | "flat" };
  rightSlot?: ReactNode;
  onPress?: () => void;
}

function HeroKpiCardInner({
  label,
  value,
  subtitle,
  delta,
  rightSlot,
  onPress,
}: HeroKpiCardProps) {
  const deltaColor =
    delta?.direction === "up"
      ? Colors.primary
      : delta?.direction === "down"
        ? Colors.danger
        : Colors.textMuted;

  const deltaGlyph =
    delta?.direction === "up" ? "↑" : delta?.direction === "down" ? "↓" : "—";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 0,
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: Spacing.sm,
        minHeight: 100,
        opacity: pressed && onPress ? 0.75 : 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      })}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...Typography.micro, marginBottom: 4 }}>{label}</Text>
        <Text
          style={{
            fontSize: FontSizes.h1,
            fontWeight: "800",
            letterSpacing: -0.5,
            color: Colors.text,
          }}
          numberOfLines={1}
        >
          {value}
        </Text>
        {subtitle ? (
          <Text
            style={{ ...Typography.micro, marginTop: 2, color: Colors.textSecondary }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
        {delta ? (
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 3 }}>
            <Text style={{ fontSize: FontSizes.caption, fontWeight: "700", color: deltaColor }}>
              {deltaGlyph} {delta.value}
            </Text>
          </View>
        ) : null}
      </View>
      {rightSlot ? (
        <View style={{ marginLeft: Spacing.xs }}>{rightSlot}</View>
      ) : null}
    </Pressable>
  );
}

export const HeroKpiCard = React.memo(HeroKpiCardInner);
