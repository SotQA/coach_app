import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Colors } from "../../theme/colors";
import { useI18n } from "../../context/I18nContext";

const CIRCLE_SIZE = 72;
const BADGE_SIZE = 18;

interface PhotoPickerCircleProps {
  /** Local (already resized) file URI, or null when no photo has been picked. */
  uri: string | null;
  onChange: (uri: string | null) => void;
  disabled?: boolean;
}

/**
 * Registration-only avatar picker. Unlike avatarService.uploadAvatar, this
 * never uploads — there's no uid yet at Step 2 — it only resizes/compresses
 * locally and hands the caller a local URI. The screen uploads it to Storage
 * once the account (and its uid) exists, at the final Continue.
 */
export function PhotoPickerCircle({ uri, onChange, disabled }: PhotoPickerCircleProps) {
  const { t } = useI18n();
  const [processing, setProcessing] = useState(false);

  // Front-camera captures come back mirrored (matching the live viewfinder,
  // not real life) — flip camera-sourced photos so the saved image matches
  // what the user actually looks like. Library picks need no correction.
  const processAndSet = async (
    localUri: string,
    options?: { flipHorizontal?: boolean; squareCrop?: { originX: number; originY: number; size: number } }
  ) => {
    setProcessing(true);
    try {
      const operations: ImageManipulator.Action[] = [];
      if (options?.flipHorizontal) operations.push({ flip: ImageManipulator.FlipType.Horizontal });
      if (options?.squareCrop) {
        const { originX, originY, size } = options.squareCrop;
        operations.push({ crop: { originX, originY, width: size, height: size } });
      }
      operations.push({ resize: { width: 400, height: 400 } });
      const manipulated = await ImageManipulator.manipulateAsync(
        localUri,
        operations,
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      onChange(manipulated.uri);
    } finally {
      setProcessing(false);
    }
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("cameraPermissionDenied"));
      return;
    }
    // allowsEditing is intentionally left off: expo-image-picker's native
    // crop/review screen renders front-camera shots mirrored (a platform
    // quirk, unrelated to the final file), which is exactly what was being
    // reported. Skipping it avoids showing that mirrored screen at all — we
    // center-crop to square ourselves instead.
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    const asset = res.assets?.[0];
    if (res.canceled || !asset?.uri) return;
    const size = Math.min(asset.width, asset.height);
    const squareCrop = { originX: Math.round((asset.width - size) / 2), originY: Math.round((asset.height - size) / 2), size };
    await processAndSet(asset.uri, { flipHorizontal: true, squareCrop });
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("photoPermissionDenied"));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    await processAndSet(res.assets[0].uri);
  };

  const openActionSheet = () => {
    Alert.alert(t("profilePhoto"), undefined, [
      { text: t("takePhoto"), onPress: () => pickFromCamera() },
      { text: t("chooseFromLibrary"), onPress: () => pickFromLibrary() },
      ...(uri ? [{ text: t("removePhoto"), style: "destructive" as const, onPress: () => onChange(null) }] : []),
      { text: t("cancel"), style: "cancel" as const },
    ]);
  };

  const busy = processing || disabled;

  return (
    <View style={{ alignItems: "center", marginBottom: 16 }}>
      <Pressable
        onPress={busy ? undefined : openActionSheet}
        accessibilityRole="button"
        accessibilityLabel={uri ? t("changePhoto") : t("addPhoto")}
      >
        <View
          style={{
            width: CIRCLE_SIZE,
            height: CIRCLE_SIZE,
            borderRadius: CIRCLE_SIZE / 2,
            backgroundColor: "#2A2A2C",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: uri ? Colors.primary : "#444",
            borderStyle: uri ? "solid" : "dashed",
          }}
        >
          {uri ? (
            <Image
              source={{ uri }}
              style={{ width: CIRCLE_SIZE - 4, height: CIRCLE_SIZE - 4, borderRadius: (CIRCLE_SIZE - 4) / 2 }}
              contentFit="cover"
            />
          ) : (
            <Text style={{ fontSize: 22 }}>📷</Text>
          )}

          {processing ? (
            <View
              style={{
                position: "absolute",
                width: CIRCLE_SIZE,
                height: CIRCLE_SIZE,
                borderRadius: CIRCLE_SIZE / 2,
                backgroundColor: "rgba(0,0,0,0.5)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : null}

          {uri && !processing ? (
            <View
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: BADGE_SIZE,
                height: BADGE_SIZE,
                borderRadius: BADGE_SIZE / 2,
                backgroundColor: Colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 10 }}>✏️</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      <Text style={{ marginTop: 8, fontSize: 12, textAlign: "center", color: uri ? Colors.primary : Colors.textMuted }}>
        {uri ? (
          t("regPhotoAdded")
        ) : (
          <>
            {t("regPhotoHintPrefix")}
            <Text style={{ color: Colors.primary }}>{t("regPhotoHintHighlight")}</Text>
          </>
        )}
      </Text>
    </View>
  );
}
