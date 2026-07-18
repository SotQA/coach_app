import React from "react";
import { Pressable, Text, View } from "react-native";
import type { RosterEntry } from "../../../utils/rosterAggregates";
import { Avatar } from "../../Avatar";
import { StatusPill } from "../StatusPill";
import { Sparkline } from "../Sparkline";
import { Colors } from "../../../theme/colors";
import { Spacing } from "../../../theme/spacing";
import { Typography } from "../../../theme/typography";

export const ATTENTION_ITEM_HEIGHT = 76;

interface AttentionListItemProps {
  entry: RosterEntry;
  onPress: () => void;
}

function studentInitials(entry: RosterEntry): string {
  const f = entry.student.firstName?.[0] ?? "";
  const l = entry.student.lastName?.[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

function studentName(entry: RosterEntry): string {
  const full = `${entry.student.firstName ?? ""} ${entry.student.lastName ?? ""}`.trim();
  return full || "Student";
}

function AttentionListItemInner({ entry, onPress }: AttentionListItemProps) {
  const target = entry.weeklyTarget ?? 0;
  const sessLabel = `${entry.sessionsThisWeek} of ${target} this week`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        height: ATTENTION_ITEM_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: Colors.card,
        borderRadius: 12,
        paddingHorizontal: Spacing.sm,
        gap: Spacing.sm,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Avatar
        size={44}
        photoURL={entry.student.photoURL}
        initials={studentInitials(entry)}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...Typography.section, fontSize: 15 }} numberOfLines={1}>
          {studentName(entry)}
        </Text>
        <Text style={{ ...Typography.secondary, fontSize: 13 }} numberOfLines={1}>
          {sessLabel}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <StatusPill status={entry.status} size="sm" />
        <Sparkline
          points={entry.sessionsPerWeekSeries}
          width={80}
          height={28}
          highlightLast
        />
      </View>
    </Pressable>
  );
}

export const AttentionListItem = React.memo(AttentionListItemInner);
