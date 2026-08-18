import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Avatar } from "../../components/Avatar";
import { InputField } from "../../components/InputField";
import { PrimaryButton } from "../../components/PrimaryButton";
import { MessengerContactFields } from "../../components/registration/MessengerContactFields";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { avatarService } from "../../services/avatarService";
import { logger } from "../../utils/logger";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";
import { getUserInitials } from "../../utils/userDisplay";
import { getDefaultDialCode, resolveMessengerContact } from "../../utils/messengerValidation";
import type { Sex, MessengerType } from "../../types/User";

const PRESS_SCALE = 0.97;
const AVATAR_SIZE = 88;

function parseYMD(value: string): Date | null {
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map((p) => Number(p));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  return new Date(y, m - 1, d);
}

function formatYMD(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function SpringPress({
  children,
  onPress,
  disabled,
  style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  style?: object;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => { if (!disabled) scale.value = withSpring(PRESS_SCALE); }}
      onPressOut={() => { scale.value = withSpring(1); }}
      style={style}
    >
      <Animated.View style={animStyle}>{children}</Animated.View>
    </Pressable>
  );
}

function SexChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const chipAnim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(PRESS_SCALE); }}
      onPressOut={() => { scale.value = withSpring(1); }}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={[
          {
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: selected ? Colors.primary : Colors.border,
            borderRadius: Radius.sm,
            backgroundColor: selected ? "rgba(212,255,68,0.12)" : Colors.surface,
            alignItems: "center",
          },
          chipAnim,
        ]}
      >
        <Text style={{ ...Typography.section, fontSize: 14, fontWeight: "700" }}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function SexChipGroup({ value, onChange }: { value: Sex; onChange: (v: Sex) => void }) {
  const { t } = useI18n();
  return (
    <View style={{ flexDirection: "row", gap: Spacing.xs }}>
      <SexChip label={t("male")} selected={value === "male"} onPress={() => onChange("male")} />
      <SexChip label={t("female")} selected={value === "female"} onPress={() => onChange("female")} />
    </View>
  );
}

/** Best-effort split of a stored "+<dial><digits>" WhatsApp number back into local digits for the input field. */
function splitWhatsappLocal(fullNumber: string | null | undefined): string {
  if (!fullNumber) return "";
  const digits = fullNumber.replace(/^\+/, "");
  const dial = getDefaultDialCode().dialCode;
  return digits.startsWith(dial) ? digits.slice(dial.length) : digits;
}

export default function EditProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ focus?: string }>();
  const { user, updateProfile, refreshUser } = useAuth();
  const { t } = useI18n();

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth ?? "");
  const [sex, setSex] = useState<Sex>(user?.sex ?? "other");
  const [dobPickerOpen, setDobPickerOpen] = useState(false);
  const [dobDraft, setDobDraft] = useState<Date | null>(null);
  const [messengerType, setMessengerType] = useState<MessengerType>((user?.messengerType as MessengerType) ?? "telegram");
  const [telegramInput, setTelegramInput] = useState(user?.messengerType === "telegram" ? user?.messengerHandle ?? "" : "");
  const [whatsappInput, setWhatsappInput] = useState(
    user?.messengerType === "whatsapp" ? splitWhatsappLocal(user?.messengerHandle) : ""
  );
  const [messengerError, setMessengerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoStatus, setPhotoStatus] = useState<"idle" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView | null>(null);
  const messengerSectionY = useRef(0);
  const hasScrolledToFocus = useRef(false);

  const originals = useRef({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    dateOfBirth: user?.dateOfBirth ?? "",
    sex: (user?.sex ?? "other") as Sex,
    messengerType: (user?.messengerType ?? null) as MessengerType | null,
    messengerHandle: user?.messengerHandle ?? null,
  });

  useEffect(() => {
    originals.current = {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      dateOfBirth: user?.dateOfBirth ?? "",
      sex: (user?.sex ?? "other") as Sex,
      messengerType: (user?.messengerType ?? null) as MessengerType | null,
      messengerHandle: user?.messengerHandle ?? null,
    };
    setFirstName(user?.firstName ?? "");
    setLastName(user?.lastName ?? "");
    setDateOfBirth(user?.dateOfBirth ?? "");
    setSex(user?.sex ?? "other");
    setMessengerType((user?.messengerType as MessengerType) ?? "telegram");
    setTelegramInput(user?.messengerType === "telegram" ? user?.messengerHandle ?? "" : "");
    setWhatsappInput(user?.messengerType === "whatsapp" ? splitWhatsappLocal(user?.messengerHandle) : "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Deep-link support: "Add in Edit Profile" / "Add in Settings" warning
  // links pass ?focus=messenger so this screen scrolls straight to the field.
  useEffect(() => {
    if (params.focus === "messenger" && messengerSectionY.current > 0 && !hasScrolledToFocus.current) {
      hasScrolledToFocus.current = true;
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: Math.max(0, messengerSectionY.current - 24), animated: true });
      });
    }
  }, [params.focus]);

  const buildContactPayload = useCallback(
    () => resolveMessengerContact(messengerType, telegramInput, whatsappInput),
    [messengerType, telegramInput, whatsappInput]
  );

  const hasChanges = useCallback(() => {
    const o = originals.current;
    const { contact } = buildContactPayload();
    const newMessengerType = contact?.messengerType ?? null;
    const newMessengerHandle = contact?.messengerHandle ?? null;
    return (
      firstName.trim() !== o.firstName.trim() ||
      lastName.trim() !== o.lastName.trim() ||
      dateOfBirth.trim() !== o.dateOfBirth.trim() ||
      sex !== o.sex ||
      newMessengerType !== o.messengerType ||
      newMessengerHandle !== o.messengerHandle
    );
  }, [firstName, lastName, dateOfBirth, sex, buildContactPayload]);

  const dobValue = dateOfBirth ? parseYMD(dateOfBirth) ?? new Date(2000, 0, 1) : new Date(2000, 0, 1);
  const activeDobValue = dobDraft ?? dobValue;

  const roleLabel =
    user?.role === "coach" ? t("roleCoach") : user?.role === "student" ? t("roleStudent") : "—";

  const currentPhotoURL = user?.photoURL ?? null;
  const initials = getUserInitials(user ?? null, user?.role === "coach" ? "C" : "S");

  // ── Photo upload helpers ────────────────────────────────────────────────────

  const handleUpload = async (localUri: string, fromCamera = false) => {
    if (!user?.id) return;
    setError(null);
    setPhotoStatus("idle");
    setPhotoUploading(true);
    try {
      await avatarService.uploadAvatar(user.id, localUri, { flipHorizontal: fromCamera });
      await refreshUser();
      setPhotoStatus("success");
      setTimeout(() => setPhotoStatus("idle"), 2000);
    } catch (e) {
      logger.error("[edit-profile] avatar upload failed", e);
      setError(t("photoUploadFailed"));
    } finally {
      setPhotoUploading(false);
    }
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError(t("cameraPermissionDenied"));
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (res.canceled || !res.assets?.[0]?.uri) return;

    // Pre-flip the captured URI so any preview matches what we upload.
    // iOS front-camera assets are mirrored like the viewfinder; normalize here
    // so we don't rely on upload-time flip (avoids preview vs final mismatch).
    const flipped = await ImageManipulator.manipulateAsync(
      res.assets[0].uri,
      [{ flip: ImageManipulator.FlipType.Horizontal }],
      { format: ImageManipulator.SaveFormat.JPEG }
    );

    await handleUpload(flipped.uri, false);
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(t("photoPermissionDenied"));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    await handleUpload(res.assets[0].uri);
  };

  const removePhoto = async () => {
    if (!user?.id) return;
    setError(null);
    setPhotoStatus("idle");
    setPhotoUploading(true);
    try {
      await avatarService.deleteAvatar(user.id);
      await refreshUser();
      setPhotoStatus("success");
      setTimeout(() => setPhotoStatus("idle"), 2000);
    } catch (e) {
      logger.error("[edit-profile] avatar delete failed", e);
      setError(t("photoUploadFailed"));
    } finally {
      setPhotoUploading(false);
    }
  };

  const openPhotoActionSheet = () => {
    Alert.alert(t("profilePhoto"), undefined, [
      { text: t("takePhoto"), onPress: () => pickFromCamera() },
      { text: t("chooseFromLibrary"), onPress: () => pickFromLibrary() },
      ...(currentPhotoURL
        ? [{ text: t("removePhoto"), style: "destructive" as const, onPress: () => removePhoto() }]
        : []),
      { text: t("cancel"), style: "cancel" as const },
    ]);
  };

  // ── Profile field save ──────────────────────────────────────────────────────

  const handleSave = async () => {
    setError(null);
    setMessengerError(null);

    const { error: contactErr, contact } = buildContactPayload();
    if (contactErr) {
      setMessengerError(contactErr);
      return;
    }

    if (!hasChanges()) {
      router.back();
      return;
    }
    setSubmitting(true);
    try {
      const patch: Parameters<typeof updateProfile>[0] = {};
      const o = originals.current;
      if (firstName.trim() !== o.firstName.trim()) patch.firstName = firstName.trim();
      if (lastName.trim() !== o.lastName.trim()) patch.lastName = lastName.trim();
      if (dateOfBirth.trim() !== o.dateOfBirth.trim()) patch.dateOfBirth = dateOfBirth.trim();
      if (sex !== o.sex) patch.sex = sex;
      const newMessengerType = contact?.messengerType ?? null;
      const newMessengerHandle = contact?.messengerHandle ?? null;
      if (newMessengerType !== o.messengerType) patch.messengerType = newMessengerType;
      if (newMessengerHandle !== o.messengerHandle) patch.messengerHandle = newMessengerHandle;
      await updateProfile(patch);
      router.back();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("failedToUpdateProfile"));
    } finally {
      setSubmitting(false);
    }
  };

  const isWorking = submitting || photoUploading;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg, paddingTop: insets.top }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: Spacing.xl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: Spacing.md,
            paddingTop: Spacing.lg,
            paddingBottom: Spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: Colors.border,
            gap: Spacing.sm,
          }}
        >
          <SpringPress onPress={() => router.back()} style={{ flexShrink: 0 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: Radius.md,
                backgroundColor: Colors.card,
                borderWidth: 1,
                borderColor: Colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="chevron-back" size={24} color={Colors.text} />
            </View>
          </SpringPress>
          <Text style={{ ...Typography.title, fontSize: FontSizes.h3 }}>{t("editProfile")}</Text>
        </View>

        <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.lg, gap: Spacing.md }}>
          {/* Avatar section */}
          <View style={{ alignItems: "center", marginBottom: Spacing.sm }}>
            <Pressable
              onPress={photoUploading ? undefined : openPhotoActionSheet}
              accessibilityRole="button"
              accessibilityLabel={currentPhotoURL ? t("changePhoto") : t("addPhoto")}
            >
              <View style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}>
                <Avatar
                  photoURL={currentPhotoURL}
                  initials={initials}
                  size={AVATAR_SIZE}
                  backgroundColor={Colors.surface}
                  textColor={Colors.primary}
                  borderColor={Colors.primary}
                  borderWidth={2}
                />
                {photoUploading ? (
                  <View
                    style={{
                      ...StyleSheet.absoluteFillObject,
                      borderRadius: AVATAR_SIZE / 2,
                      backgroundColor: "rgba(0,0,0,0.5)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ActivityIndicator color={Colors.primary} />
                  </View>
                ) : null}
              </View>
            </Pressable>

            <Pressable
              onPress={photoUploading ? undefined : openPhotoActionSheet}
              disabled={photoUploading}
              style={{ marginTop: Spacing.sm }}
            >
              <Text
                style={{
                  ...Typography.secondary,
                  color: photoUploading ? Colors.textMuted : Colors.primary,
                  fontWeight: "700",
                }}
              >
                {currentPhotoURL ? t("changePhoto") : t("addPhoto")}
              </Text>
            </Pressable>

            {photoStatus === "success" ? (
              <Text style={{ ...Typography.secondary, color: Colors.success, marginTop: 4 }}>
                {t("photoSaved")}
              </Text>
            ) : null}
          </View>

          {/* First name */}
          <InputField
            label={t("firstName")}
            value={firstName}
            onChangeText={setFirstName}
            placeholder={t("firstName")}
            autoCapitalize="words"
            maxLength={40}
          />

          {/* Last name */}
          <InputField
            label={t("lastName")}
            value={lastName}
            onChangeText={setLastName}
            placeholder={t("lastName")}
            autoCapitalize="words"
            maxLength={40}
          />

          {/* Date of birth */}
          <View>
            <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.text, marginBottom: 8 }}>
              {t("dateOfBirth")}
            </Text>
            <SpringPress onPress={() => setDobPickerOpen(true)}>
              <View
                style={{
                  height: 56,
                  borderRadius: 14,
                  backgroundColor: Colors.inputBg,
                  borderWidth: 1,
                  borderColor: Colors.hairlineStrong,
                  paddingHorizontal: 16,
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 16, color: dateOfBirth ? Colors.text : Colors.textMuted }}>
                  {dateOfBirth || t("selectDate")}
                </Text>
              </View>
            </SpringPress>

            {dobPickerOpen ? (
              <DateTimePicker
                value={activeDobValue}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(event, selectedDate) => {
                  if (selectedDate) setDobDraft(selectedDate);
                  if (Platform.OS === "android") {
                    if (event?.type === "set" && selectedDate) {
                      setDateOfBirth(formatYMD(selectedDate));
                      setDobDraft(null);
                      setDobPickerOpen(false);
                    } else if (event?.type === "dismissed") {
                      setDobDraft(null);
                      setDobPickerOpen(false);
                    }
                  }
                }}
              />
            ) : null}

            {dobPickerOpen && Platform.OS === "ios" ? (
              <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm, alignItems: "stretch" }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    title={t("apply")}
                    onPress={() => {
                      if (!dobDraft) return;
                      setDateOfBirth(formatYMD(dobDraft));
                      setDobDraft(null);
                      setDobPickerOpen(false);
                    }}
                  />
                </View>
                <SpringPress onPress={() => { setDobDraft(null); setDobPickerOpen(false); }}>
                  <View
                    style={{
                      paddingVertical: 15,
                      paddingHorizontal: Spacing.md,
                      borderRadius: Radius.lg,
                      backgroundColor: Colors.surface,
                      borderWidth: 1,
                      borderColor: Colors.border,
                    }}
                  >
                    <Text style={{ ...Typography.section, color: Colors.textMuted }}>{t("cancel")}</Text>
                  </View>
                </SpringPress>
              </View>
            ) : null}
          </View>

          {/* Sex */}
          <View>
            <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.text, marginBottom: 8 }}>
              {t("sex")}
            </Text>
            <SexChipGroup value={sex} onChange={setSex} />
          </View>

          {/* Messenger contact */}
          <View onLayout={(e) => { messengerSectionY.current = e.nativeEvent.layout.y; }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.text, marginBottom: 8 }}>
              {t("messengerContactSectionTitle")}
            </Text>
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontSize: 12, marginBottom: 10 }}>
              {t("messengerContactSectionSub")}
            </Text>
            <MessengerContactFields
              type={messengerType}
              onChangeType={(v) => { setMessengerType(v); setMessengerError(null); }}
              telegramInput={telegramInput}
              onChangeTelegramInput={(v) => { setTelegramInput(v); setMessengerError(null); }}
              whatsappInput={whatsappInput}
              onChangeWhatsappInput={(v) => { setWhatsappInput(v); setMessengerError(null); }}
              error={messengerError}
            />
          </View>

          {/* Read-only: email */}
          <View>
            <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.text, marginBottom: 8 }}>
              {t("email")}
            </Text>
            <View
              style={{
                height: 56,
                borderRadius: 14,
                backgroundColor: Colors.inputBg,
                borderWidth: 1,
                borderColor: Colors.hairline,
                paddingHorizontal: 16,
                justifyContent: "center",
                opacity: 0.6,
              }}
            >
              <Text style={{ fontSize: 16, color: Colors.text }}>{user?.email ?? "—"}</Text>
            </View>
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontSize: 12, marginTop: 6 }}>
              {t("emailNotEditable")}
            </Text>
          </View>

          {/* Read-only: role */}
          <View>
            <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.text, marginBottom: 8 }}>
              {t("roleLabel")}
            </Text>
            <View
              style={{
                height: 56,
                borderRadius: 14,
                backgroundColor: Colors.inputBg,
                borderWidth: 1,
                borderColor: Colors.hairline,
                paddingHorizontal: 16,
                justifyContent: "center",
                opacity: 0.6,
              }}
            >
              <Text style={{ fontSize: 16, color: Colors.text }}>{roleLabel}</Text>
            </View>
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontSize: 12, marginTop: 6 }}>
              {t("roleNotEditable")}
            </Text>
          </View>

          {/* Error */}
          {error ? (
            <Text style={{ ...Typography.secondary, color: Colors.danger, fontWeight: "600" }}>
              {error}
            </Text>
          ) : null}

          {/* Save button */}
          <PrimaryButton
            title={t("saveChanges")}
            onPress={handleSave}
            loading={submitting}
            disabled={isWorking}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
