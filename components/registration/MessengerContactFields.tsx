import { useMemo } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { useI18n } from "../../context/I18nContext";
import { getDefaultDialCode } from "../../utils/messengerValidation";
import type { MessengerType } from "../../types/User";

interface MessengerContactFieldsProps {
  type: MessengerType;
  onChangeType: (t: MessengerType) => void;
  telegramInput: string;
  onChangeTelegramInput: (v: string) => void;
  whatsappInput: string;
  onChangeWhatsappInput: (v: string) => void;
  error?: string | null;
}

function MessengerPill({
  icon,
  label,
  selected,
  onPress,
}: {
  icon: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={label}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingVertical: 10,
          paddingHorizontal: Spacing.sm,
          borderRadius: Radius.sm,
          backgroundColor: selected ? "#1A2200" : "#2A2A2C",
          borderWidth: 1,
          borderColor: selected ? Colors.primary : "transparent",
        }}
      >
        <Text style={{ fontSize: 15 }}>{icon}</Text>
        <Text style={{ fontSize: 13, fontWeight: "600", color: selected ? Colors.primary : "#AAA" }}>{label}</Text>
        {selected ? (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: Colors.primary,
              marginLeft: "auto",
            }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

export function MessengerContactFields({
  type,
  onChangeType,
  telegramInput,
  onChangeTelegramInput,
  whatsappInput,
  onChangeWhatsappInput,
  error,
}: MessengerContactFieldsProps) {
  const { t } = useI18n();
  const dial = useMemo(() => getDefaultDialCode(), []);

  return (
    <View>
      <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 6, fontWeight: "600" }}>
        {t("preferredMessenger")}
      </Text>
      <View style={{ flexDirection: "row", gap: Spacing.xs, marginBottom: Spacing.sm }}>
        <MessengerPill icon="✈️" label={t("messengerTelegram")} selected={type === "telegram"} onPress={() => onChangeType("telegram")} />
        <MessengerPill icon="📱" label={t("messengerWhatsapp")} selected={type === "whatsapp"} onPress={() => onChangeType("whatsapp")} />
      </View>

      {type === "telegram" ? (
        <View>
          <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 4 }}>{t("telegramUsernameLabel")}</Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: Colors.inputBg,
              borderRadius: Radius.sm,
              borderWidth: 1,
              borderColor: error ? Colors.danger : Colors.hairlineStrong,
              paddingHorizontal: 14,
              height: 50,
            }}
          >
            <Text style={{ color: Colors.textMuted, fontSize: 15, marginRight: 4 }}>@</Text>
            <TextInput
              value={telegramInput}
              onChangeText={onChangeTelegramInput}
              placeholder={t("telegramUsernamePlaceholder")}
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={{ flex: 1, color: Colors.text, fontSize: 15, padding: 0 }}
            />
          </View>
          <Text style={{ fontSize: 11, color: error ? Colors.danger : "#555", marginTop: 6 }}>
            {error ? t(error) : t("telegramHint")}
          </Text>
        </View>
      ) : (
        <View>
          <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 4 }}>{t("whatsappPhoneLabel")}</Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: Colors.inputBg,
              borderRadius: Radius.sm,
              borderWidth: 1,
              borderColor: error ? Colors.danger : Colors.hairlineStrong,
              paddingHorizontal: 14,
              height: 50,
            }}
          >
            <Text style={{ color: Colors.textMuted, fontSize: 15, marginRight: 6 }}>
              {dial.flag} +{dial.dialCode}
            </Text>
            <TextInput
              value={whatsappInput}
              onChangeText={onChangeWhatsappInput}
              placeholder={t("whatsappPhonePlaceholder")}
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              style={{ flex: 1, color: Colors.text, fontSize: 15, padding: 0 }}
            />
          </View>
          <Text style={{ fontSize: 11, color: error ? Colors.danger : "#555", marginTop: 6 }}>
            {error ? t(error) : t("whatsappHint")}
          </Text>
        </View>
      )}
    </View>
  );
}
