import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import Svg, { Polyline, Circle, Line } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import type { TimeRangePreset, WeeklyPoint, WeeklyVolLoad } from "../../utils/coachProgressAnalytics";

export const TIME_PRESETS: { key: TimeRangePreset; label: string }[] = [
  { key: "4w", label: "4 weeks" },
  { key: "8w", label: "8 weeks" },
  { key: "3m", label: "3 months" },
  { key: "6m", label: "6 months" },
  { key: "all", label: "All time" },
];

export function MiniLineChart({
  points,
  color,
  height,
  highlightPr,
  width,
}: {
  points: WeeklyPoint[];
  color: string;
  height: number;
  highlightPr: boolean;
  width: number;
}) {
  const W = width;
  const H = height;
  const padX = 8;
  const padY = 10;

  const vals = points.map((p) => p.value);
  const minV = vals.length ? Math.min(...vals) : 0;
  const maxV = vals.length ? Math.max(...vals) : 1;
  const span = maxV - minV || 1;

  const coords = points.map((p, i) => {
    const x = padX + (points.length <= 1 ? W / 2 - padX : (i / (points.length - 1)) * (W - 2 * padX));
    const y = padY + (1 - (p.value - minV) / span) * (H - 2 * padY);
    return { x, y, p };
  });

  const d = coords.map((c) => `${c.x},${c.y}`).join(" ");

  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [points]);

  return (
    <View style={{ height: H + 28 }}>
      <Svg width={W} height={H}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <Line
            key={t}
            x1={0}
            x2={W}
            y1={padY + t * (H - 2 * padY)}
            y2={padY + t * (H - 2 * padY)}
            stroke={Colors.surfaceSubtle}
            strokeWidth={1}
          />
        ))}
        {coords.length > 1 ? (
          <Polyline points={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        ) : coords.length === 1 ? (
          <Circle cx={coords[0].x} cy={coords[0].y} r={4} fill={color} />
        ) : null}
        {coords.map((c, i) => (
          <Circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={highlightPr && c.p.isPr ? 6 : 4}
            fill={highlightPr && c.p.isPr ? Colors.primary : color}
            stroke={Colors.bg}
            strokeWidth={2}
            onPress={() => setSelected(i)}
          />
        ))}
      </Svg>
      {selected != null && points[selected] ? (
        <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4, textAlign: "center" }}>
          {points[selected].label}: {points[selected].value} kg e1RM
          {points[selected].isPr ? " · PR" : ""}
        </Text>
      ) : (
        <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4, textAlign: "center" }}>
          Tap a point for details
        </Text>
      )}
    </View>
  );
}

export function DualLineChart({ data, width }: { data: WeeklyVolLoad[]; width: number }) {
  const W = width;
  const H = 140;
  const padX = 8;
  const padY = 10;
  if (data.length === 0) {
    return <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>Not enough data</Text>;
  }
  const vols = data.map((d) => d.volume);
  const loads = data.map((d) => d.avgLoad);
  const maxVol = Math.max(...vols, 1);
  const maxLoad = Math.max(...loads, 1);

  const vCoords = data.map((row, i) => {
    const x = padX + (data.length <= 1 ? W / 2 - padX : (i / (data.length - 1)) * (W - 2 * padX));
    const y = padY + (1 - row.volume / maxVol) * (H - 2 * padY);
    return `${x},${y}`;
  });
  const lCoords = data.map((row, i) => {
    const x = padX + (data.length <= 1 ? W / 2 - padX : (i / (data.length - 1)) * (W - 2 * padX));
    const y = padY + (1 - row.avgLoad / maxLoad) * (H - 2 * padY);
    return `${x},${y}`;
  });

  return (
    <Svg width={W} height={H}>
      {[0, 0.5, 1].map((t) => (
        <Line
          key={t}
          x1={0}
          x2={W}
          y1={padY + t * (H - 2 * padY)}
          y2={padY + t * (H - 2 * padY)}
          stroke={Colors.surfaceSubtle}
          strokeWidth={1}
        />
      ))}
      <Polyline points={vCoords.join(" ")} fill="none" stroke="#64D2FF" strokeWidth={2} strokeLinejoin="round" />
      <Polyline points={lCoords.join(" ")} fill="none" stroke={Colors.primary} strokeWidth={2} strokeDasharray="4 4" />
    </Svg>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  deltaPct,
  unit,
}: {
  label: string;
  value: string;
  delta: number | null;
  deltaPct: number | null;
  unit?: string;
}) {
  const up = delta != null && delta > 0;
  const down = delta != null && delta < 0;
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
      }}
    >
      <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>{label}</Text>
      <Text style={{ ...Typography.title, fontSize: 22, marginTop: 6 }}>
        {value}
        {unit ? <Text style={{ ...Typography.secondary, fontSize: 14 }}> {unit}</Text> : null}
      </Text>
      {delta != null ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
          <Ionicons
            name={up ? "trending-up" : down ? "trending-down" : "remove"}
            size={16}
            color={up ? Colors.success : down ? Colors.danger : Colors.textMuted}
          />
          <Text
            style={{
              ...Typography.secondary,
              color: up ? Colors.success : down ? Colors.danger : Colors.textMuted,
              fontWeight: "700",
            }}
          >
            {delta > 0 ? "+" : ""}
            {delta}
            {deltaPct != null ? ` (${deltaPct > 0 ? "+" : ""}${deltaPct}%)` : ""}
          </Text>
        </View>
      ) : (
        <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 8 }}>—</Text>
      )}
    </View>
  );
}
