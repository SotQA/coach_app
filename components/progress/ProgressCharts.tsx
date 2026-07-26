import { Fragment, useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import Svg, { Polyline, Polygon, Circle, Line, Text as SvgText } from "react-native-svg";
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

// Reserved gutter for a vertical-axis number column (e.g. "140") and the gap before the plot area.
const AXIS_GUTTER = 28;
const AXIS_GAP = 6;
const AXIS_FONT_SIZE = 10;

// Expands a data range a bit beyond its min/max so the line doesn't touch the chart edges
// and axis ticks read as a sensible scale rather than exactly bounding the data.
function paddedRange(min: number, max: number) {
  const span = max - min || 1;
  const pad = Math.max(span * 0.15, 1);
  return { lo: min - pad, hi: max + pad };
}

// t=0 is the top gridline (value = hi), t=1 is the bottom gridline (value = lo) — matching
// the y = padY + (1 - (value-lo)/span) * plotHeight convention used for data points below.
function buildTicks(lo: number, hi: number, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const t = count <= 1 ? 0 : i / (count - 1);
    return { t, value: Math.round(hi - t * (hi - lo)) };
  });
}

// Full-height invisible tap columns, one per data point, so the tappable area is a
// generous vertical strip rather than the small painted dot itself (dots are hard to
// hit precisely on a phone screen).
function TapColumns({
  coords,
  width,
  height,
  onSelect,
}: {
  coords: { x: number }[];
  width: number;
  height: number;
  onSelect: (i: number) => void;
}) {
  const n = coords.length;
  const spacing = n > 1 ? coords[1].x - coords[0].x : width;
  const colWidth = Math.max(16, Math.min(40, spacing || 40));
  return (
    <View style={{ position: "absolute", top: 0, left: 0, width, height }}>
      {coords.map((c, i) => (
        <Pressable
          key={i}
          onPress={() => onSelect(i)}
          style={{ position: "absolute", left: c.x - colWidth / 2, top: 0, width: colWidth, height }}
        />
      ))}
    </View>
  );
}

function WeekAxisLabels({ coords, plotWidth }: { coords: { x: number }[]; plotWidth: number }) {
  const labelWidth = 32;
  const maxLabels = Math.max(1, Math.floor(plotWidth / labelWidth));
  const step = Math.max(1, Math.ceil(coords.length / maxLabels));
  return (
    <View style={{ height: 16, marginTop: 4 }}>
      {coords.map((c, i) => {
        const isLast = i === coords.length - 1;
        if (!isLast && i % step !== 0) return null;
        return (
          <Text
            key={i}
            numberOfLines={1}
            style={{
              position: "absolute",
              top: 0,
              left: c.x - labelWidth / 2,
              width: labelWidth,
              textAlign: "center",
              fontSize: FontSizes.tiny,
              color: Colors.textMuted,
            }}
          >
            {`W${i + 1}`}
          </Text>
        );
      })}
    </View>
  );
}

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
  const padY = 10;
  const plotLeft = AXIS_GUTTER + AXIS_GAP;
  const plotRight = W - 8;
  const plotWidth = plotRight - plotLeft;

  const vals = points.map((p) => p.value);
  const rawMin = vals.length ? Math.min(...vals) : 0;
  const rawMax = vals.length ? Math.max(...vals) : 1;
  const { lo: minV, hi: maxV } = paddedRange(rawMin, rawMax);
  const span = maxV - minV;

  const coords = points.map((p, i) => {
    const x = plotLeft + (points.length <= 1 ? plotWidth / 2 : (i / (points.length - 1)) * plotWidth);
    const y = padY + (1 - (p.value - minV) / span) * (H - 2 * padY);
    return { x, y, p };
  });

  const d = coords.map((c) => `${c.x},${c.y}`).join(" ");

  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [points]);

  const yTicks = buildTicks(minV, maxV, 6);
  let lastYLabel: number | null = null;

  return (
    <View>
      <Svg width={W} height={H}>
        {yTicks.map((tick, i) => {
          const y = padY + tick.t * (H - 2 * padY);
          const showLabel = tick.value !== lastYLabel;
          if (showLabel) lastYLabel = tick.value;
          return (
            <Fragment key={`h${i}`}>
              <Line x1={plotLeft} x2={plotRight} y1={y} y2={y} stroke={Colors.surfaceSubtle} strokeWidth={1} />
              {showLabel ? (
                <SvgText x={plotLeft - AXIS_GAP} y={y + 3} fill={Colors.textMuted} fontSize={AXIS_FONT_SIZE} textAnchor="end">
                  {tick.value}
                </SvgText>
              ) : null}
            </Fragment>
          );
        })}
        {coords.map((c, i) => (
          <Line key={`v${i}`} x1={c.x} x2={c.x} y1={padY} y2={H - padY} stroke={Colors.surfaceSubtle} strokeWidth={1} />
        ))}
        {coords.length > 1 ? (
          <Polygon
            points={`${d} ${coords[coords.length - 1].x},${H - padY} ${coords[0].x},${H - padY}`}
            fill={color}
            fillOpacity={0.12}
            stroke="none"
          />
        ) : null}
        {coords.length > 1 ? (
          <Polyline points={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        ) : coords.length === 1 ? (
          <Circle cx={coords[0].x} cy={coords[0].y} r={5} fill={color} />
        ) : null}
        {coords.map((c, i) => (
          <Circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={5}
            fill={highlightPr && c.p.isPr ? Colors.primary : color}
            stroke={Colors.bg}
            strokeWidth={2}
          />
        ))}
      </Svg>
      <TapColumns coords={coords} width={W} height={H} onSelect={setSelected} />
      <WeekAxisLabels coords={coords} plotWidth={plotWidth} />
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
  const H = 190;
  const padY = 10;
  const plotLeft = AXIS_GUTTER + AXIS_GAP;
  const plotRight = W - AXIS_GUTTER - AXIS_GAP;
  const plotWidth = plotRight - plotLeft;

  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [data]);

  if (data.length === 0) {
    return <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>Not enough data</Text>;
  }

  const weights = data.map((d) => d.weight);
  const reps = data.map((d) => d.reps);
  const { lo: minW, hi: maxW } = paddedRange(Math.min(...weights), Math.max(...weights));
  const spanW = maxW - minW;
  const { lo: minR, hi: maxR } = paddedRange(Math.min(...reps), Math.max(...reps));
  const spanR = maxR - minR;

  const xFor = (i: number) => plotLeft + (data.length <= 1 ? plotWidth / 2 : (i / (data.length - 1)) * plotWidth);
  const weightCoords = data.map((row, i) => ({ x: xFor(i), y: padY + (1 - (row.weight - minW) / spanW) * (H - 2 * padY) }));
  const repsCoords = data.map((row, i) => ({ x: xFor(i), y: padY + (1 - (row.reps - minR) / spanR) * (H - 2 * padY) }));

  const weightTicks = buildTicks(minW, maxW, 8);
  const repsTicks = buildTicks(minR, maxR, 8);
  let lastWeightLabel: number | null = null;
  let lastRepsLabel: number | null = null;

  return (
    <View>
      <Svg width={W} height={H}>
        {weightTicks.map((tick, i) => {
          const y = padY + tick.t * (H - 2 * padY);
          const repsVal = repsTicks[i].value;
          const showWeightLabel = tick.value !== lastWeightLabel;
          if (showWeightLabel) lastWeightLabel = tick.value;
          const showRepsLabel = repsVal !== lastRepsLabel;
          if (showRepsLabel) lastRepsLabel = repsVal;
          return (
            <Fragment key={`h${i}`}>
              <Line x1={plotLeft} x2={plotRight} y1={y} y2={y} stroke={Colors.surfaceSubtle} strokeWidth={1} />
              {showWeightLabel ? (
                <SvgText x={plotLeft - AXIS_GAP} y={y + 3} fill={Colors.chartBlue} fontSize={AXIS_FONT_SIZE} textAnchor="end">
                  {tick.value}
                </SvgText>
              ) : null}
              {showRepsLabel ? (
                <SvgText x={plotRight + AXIS_GAP} y={y + 3} fill={Colors.chartOrange} fontSize={AXIS_FONT_SIZE} textAnchor="start">
                  {repsVal}
                </SvgText>
              ) : null}
            </Fragment>
          );
        })}
        {weightCoords.map((c, i) => (
          <Line key={`v${i}`} x1={c.x} x2={c.x} y1={padY} y2={H - padY} stroke={Colors.surfaceSubtle} strokeWidth={1} />
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
          <Circle key={`w${i}`} cx={c.x} cy={c.y} r={5} fill={Colors.chartBlue} stroke={Colors.bg} strokeWidth={2} />
        ))}
        {repsCoords.map((c, i) => (
          <Circle key={`r${i}`} cx={c.x} cy={c.y} r={5} fill={Colors.chartOrange} stroke={Colors.bg} strokeWidth={2} />
        ))}
      </Svg>
      <TapColumns coords={weightCoords} width={W} height={H} onSelect={setSelected} />
      <WeekAxisLabels coords={weightCoords} plotWidth={plotWidth} />
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


