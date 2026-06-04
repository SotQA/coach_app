import React from "react";
import { Text, View } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import { Colors } from "../../theme/colors";
import { FontSizes } from "../../theme/typography";

interface WeekBarsProps {
  bars: { label: string; value: number }[];
  width: number;
  height: number;
  color?: string;
  averageLine?: boolean;
}

const LABEL_HEIGHT = 20;
const BAR_GAP = 4;

function WeekBarsInner({
  bars,
  width,
  height,
  color = Colors.primary,
  averageLine = false,
}: WeekBarsProps) {
  if (bars.length === 0) {
    return <View style={{ width, height }} />;
  }

  const maxVal = Math.max(...bars.map((b) => b.value), 1);
  const yMax = maxVal * 1.1;

  const totalGap = BAR_GAP * (bars.length - 1);
  const barWidth = (width - totalGap) / bars.length;

  const chartH = height;
  const svgH = chartH + LABEL_HEIGHT;

  const average = bars.reduce((s, b) => s + b.value, 0) / bars.length;
  const avgY = chartH * (1 - average / yMax);

  const rotateLabels = bars.length > 6;

  return (
    <View style={{ width }}>
      <Svg width={width} height={svgH}>
        {bars.map((bar, i) => {
          const x = i * (barWidth + BAR_GAP);
          const barH = Math.max(1, chartH * (bar.value / yMax));
          const y = chartH - barH;
          return (
            <Rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              fill={color}
              rx={2}
            />
          );
        })}

        {averageLine && bars.length > 1 ? (
          <Line
            x1={0}
            y1={avgY}
            x2={width}
            y2={avgY}
            stroke={Colors.hairlineStrong}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        ) : null}
      </Svg>

      <View style={{ flexDirection: "row", width, marginTop: 2 }}>
        {bars.map((bar, i) => {
          const centerX = i * (barWidth + BAR_GAP) + barWidth / 2;
          return (
            <View
              key={i}
              style={{
                position: "absolute",
                left: centerX - barWidth / 2,
                width: barWidth,
                alignItems: "center",
                transform: rotateLabels ? [{ rotate: "-40deg" }] : [],
              }}
            >
              <Text
                style={{
                  fontSize: FontSizes.micro,
                  color: Colors.textMuted,
                }}
                numberOfLines={1}
              >
                {bar.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export const WeekBars = React.memo(WeekBarsInner);
