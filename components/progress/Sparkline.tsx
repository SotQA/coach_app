import React from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { Colors } from "../../theme/colors";

interface SparklineProps {
  points: number[];
  width: number;
  height: number;
  color?: string;
  highlightLast?: boolean;
  emptyHeight?: number;
}

function SparklineInner({
  points,
  width,
  height,
  color = Colors.primary,
  highlightLast = false,
  emptyHeight,
}: SparklineProps) {
  const fallbackHeight = emptyHeight ?? height;

  if (points.length < 2) {
    const midY = fallbackHeight / 2;
    return (
      <View style={{ width, height: fallbackHeight }}>
        <Svg width={width} height={fallbackHeight}>
          <Line
            x1={0}
            y1={midY}
            x2={width}
            y2={midY}
            stroke={Colors.textMuted}
            strokeWidth={1.5}
          />
          {highlightLast && points.length === 1 ? (
            <Circle cx={width / 2} cy={midY} r={3} fill={Colors.textMuted} />
          ) : null}
        </Svg>
      </View>
    );
  }

  const minV = Math.min(...points);
  const maxV = Math.max(...points);
  const span = maxV - minV || 1;

  const pad = height * 0.05;
  const drawH = height - 2 * pad;

  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = pad + (1 - (v - minV) / span) * drawH;
    return { x, y };
  });

  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const last = coords[coords.length - 1];

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {highlightLast ? (
          <Circle cx={last.x} cy={last.y} r={3} fill={color} />
        ) : null}
      </Svg>
    </View>
  );
}

export const Sparkline = React.memo(SparklineInner);
