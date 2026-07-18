import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "../../Avatar";
import { StatusPill } from "../StatusPill";
import { Colors } from "../../../theme/colors";
import { Spacing } from "../../../theme/spacing";
import { Typography } from "../../../theme/typography";

interface CoachDrillDownHeaderProps {
  studentName: string;
  photoURL?: string | null;
  initials: string;
  status?: "ahead" | "ontrack" | "slipping" | "lagging" | null;
  lastActiveLabel?: string | null;
  onBack: () => void;
}

function CoachDrillDownHeaderInner({
  studentName,
  photoURL,
  initials,
  status,
  lastActiveLabel,
  onBack,
}: CoachDrillDownHeaderProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        backgroundColor: Colors.bg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.hairline,
        minHeight: 70,
      }}
    >
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to roster"
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Ionicons name="chevron-back" size={24} color={Colors.text} />
      </Pressable>

      <Avatar size={44} photoURL={photoURL} initials={initials} style={{ marginLeft: Spacing.xs }} />

      <View style={{ flex: 1, minWidth: 0, marginLeft: Spacing.xs }}>
        <Text style={{ ...Typography.section }} numberOfLines={1}>
          {studentName}
        </Text>
        {lastActiveLabel ? (
          <Text style={{ ...Typography.micro }} numberOfLines={1}>
            {lastActiveLabel}
          </Text>
        ) : null}
      </View>

      {status != null ? (
        <View style={{ marginLeft: Spacing.xs }}>
          <StatusPill status={status} />
        </View>
      ) : null}
    </View>
  );
}

export const CoachDrillDownHeader = React.memo(CoachDrillDownHeaderInner);
