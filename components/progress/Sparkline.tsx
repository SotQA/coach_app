import React, { useEffect, useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Colors } from "../../theme/colors";

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

interface SparklineProps {
  points: number[];
  width: number;
  height: number;
  color?: string;
  highlightLast?: boolean;
  emptyHeight?: number;
  animateOnMount?: boolean;
}

function SparklineInner({
  points,
  width,
  height,
  color = Colors.primary,
  highlightLast = false,
  emptyHeight,
  animateOnMount = true,
}: SparklineProps) {
  const reducedMotion = useReducedMotion();
  const fallbackHeight = emptyHeight ?? height;

  const { coords, polylinePoints, totalLen } = useMemo(() => {
    if (points.length < 2) return { coords: [], polylinePoints: "", totalLen: 0 };

    const minV = Math.min(...points);
    const maxV = Math.max(...points);
    const span = maxV - minV || 1;
    const pad = height * 0.05;
    const drawH = height - 2 * pad;

    const c = points.map((v, i) => ({
      x: (i / (points.length - 1)) * width,
      y: pad + (1 - (v - minV) / span) * drawH,
    }));

    let len = 0;
    for (let i = 1; i < c.length; i++) {
      const dx = c[i].x - c[i - 1].x;
      const dy = c[i].y - c[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }

    return {
      coords: c,
      polylinePoints: c.map((pt) => `${pt.x},${pt.y}`).join(" "),
      totalLen: len,
    };
  }, [points, width, height]);

  const shouldAnimate = animateOnMount && !reducedMotion && points.length >= 2;
  const offset = useSharedValue(shouldAnimate ? totalLen : 0);

  useEffect(() => {
    if (shouldAnimate && totalLen > 0) {
      offset.value = totalLen;
      offset.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });
    } else {
      offset.value = 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAnimate, totalLen]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
  }));

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

  const last = coords[coords.length - 1];

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <AnimatedPolyline
          points={polylinePoints}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={totalLen}
          animatedProps={animatedProps}
        />
        {highlightLast ? (
          <Circle cx={last.x} cy={last.y} r={3} fill={color} />
        ) : null}
      </Svg>
    </View>
  );
}

export const Sparkline = React.memo(SparklineInner);
