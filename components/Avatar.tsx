import { memo } from "react";
import { Text, View, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Colors } from "@/theme/colors";

export interface AvatarProps {
  photoURL?: string | null;
  initials: string;
  size?: number;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderWidth?: number;
  style?: ViewStyle;
}

function AvatarBase({
  photoURL,
  initials,
  size = 44,
  backgroundColor = Colors.card,
  textColor = Colors.text,
  borderColor = Colors.border,
  borderWidth = 1,
  style,
}: AvatarProps) {
  const dim = { width: size, height: size, borderRadius: size / 2 };
  const wrap: ViewStyle = {
    ...dim,
    backgroundColor,
    borderWidth,
    borderColor,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...style,
  };

  if (photoURL) {
    return (
      <View style={wrap}>
        <Image
          source={{ uri: photoURL }}
          style={dim}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
        />
      </View>
    );
  }

  return (
    <View style={wrap}>
      <Text
        style={{
          color: textColor,
          fontSize: Math.max(12, Math.round(size * 0.36)),
          fontWeight: "800",
        }}
      >
        {initials || "?"}
      </Text>
    </View>
  );
}

export const Avatar = memo(AvatarBase);
