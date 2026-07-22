import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import Svg, { Polyline, Circle, Line } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";
import type { TimeRangePreset, WeeklyPoint, WeeklyWeightReps } from "../../utils/coachProgressAnalytics";

export const TIME_PRESETS: { key: TimeRangePreset; label: string }[] = [
  { key: "2w", label: "Last 2 weeks" },
  { key: "1m", label: "Last month" },
  { key: "3m", label: "Last 3 months" },
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

export function WeightRepsChart({ data, width }: { data: WeeklyWeightReps[]; width: number }) {
  const W = width;
  const H = 160;
  const padX = 8;
  const padY = 10;

  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [data]);

  if (data.length === 0) {
    return <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>Not enough data</Text>;
  }

  const weights = data.map((d) => d.weight);
  const reps = data.map((d) => d.reps);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const spanW = maxW - minW || 1;
  const minR = Math.min(...reps);
  const maxR = Math.max(...reps);
  const spanR = maxR - minR || 1;

  const xFor = (i: number) => padX + (data.length <= 1 ? W / 2 - padX : (i / (data.length - 1)) * (W - 2 * padX));
  const weightCoords = data.map((row, i) => ({ x: xFor(i), y: padY + (1 - (row.weight - minW) / spanW) * (H - 2 * padY) }));
  const repsCoords = data.map((row, i) => ({ x: xFor(i), y: padY + (1 - (row.reps - minR) / spanR) * (H - 2 * padY) }));

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
        <Polyline
          points={weightCoords.map((c) => `${c.x},${c.y}`).join(" ")}
          fill="none"
          stroke={Colors.chartBlue}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <Polyline
          points={repsCoords.map((c) => `${c.x},${c.y}`).join(" ")}
          fill="none"
          stroke={Colors.chartOrange}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {weightCoords.map((c, i) => (
          <Circle key={`w${i}`} cx={c.x} cy={c.y} r={4} fill={Colors.chartBlue} stroke={Colors.bg} strokeWidth={2} onPress={() => setSelected(i)} />
        ))}
        {repsCoords.map((c, i) => (
          <Circle key={`r${i}`} cx={c.x} cy={c.y} r={4} fill={Colors.chartOrange} stroke={Colors.bg} strokeWidth={2} onPress={() => setSelected(i)} />
        ))}
      </Svg>
      {selected != null && data[selected] ? (
        <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4, textAlign: "center" }}>
          {data[selected].label}: {data[selected].weight} kg × {data[selected].reps} reps
        </Text>
      ) : (
        <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4, textAlign: "center" }}>
          Tap a point for details
        </Text>
      )}
    </View>
  );
}

export function ChartLegend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <View style={{ flexDirection: "row", gap: Spacing.md, marginTop: Spacing.sm }}>
      {items.map((it) => (
        <View key={it.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 12, height: 2, backgroundColor: it.color }} />
          <Text style={{ ...Typography.secondary, fontSize: FontSizes.caption, color: Colors.textSecondary }}>{it.label}</Text>
        </View>
      ))}
    </View>
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
      <Text style={{ ...Typography.title, fontSize: FontSizes.h3, marginTop: 6 }}>
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


