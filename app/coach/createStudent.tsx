import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { inviteService, type EmailCheckResult } from "../../services/inviteService";
import { getDisplayName } from "../../utils/userDisplay";
import { formatDateFull } from "../../utils/formatLocale";
import { PrimaryButton } from "../../components/PrimaryButton";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";
import { ScreenLayout } from "../../components/ScreenLayout";

const VALIDATION_DEBOUNCE_MS = 600;

type ValidationState = { status: "idle" } | { status: "checking" } | ({ status: "result" } & EmailCheckResult);

// Screen used by the coach to invite an existing student account onto their
// roster. The student is only added once they accept the invite.
export default function CreateStudent() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, locale } = useI18n();

  const [studentEmail, setStudentEmail] = useState("");
  const [validation, setValidation] = useState<ValidationState>({ status: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);

  // Guards against a slower, stale check response landing after a newer one.
  const requestIdRef = useRef(0);

  useEffect(() => {
    const email = studentEmail.trim();
    if (!email || !user || user.role !== "coach") {
      setValidation({ status: "idle" });
      return;
    }

    setValidation({ status: "checking" });
    const myRequestId = ++requestIdRef.current;

    const timer = setTimeout(() => {
      inviteService
        .checkStudentEmail(email, user.id)
        .then((result) => {
          if (requestIdRef.current !== myRequestId) return;
          setValidation({ status: "result", ...result });
        })
        .catch(() => {
          if (requestIdRef.current !== myRequestId) return;
          setValidation({ status: "idle" });
        });
    }, VALIDATION_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [studentEmail, user?.id, user?.role]);

  const isOk = validation.status === "result" && validation.state === "ok";

  const validationMessage = (() => {
    if (validation.status !== "result") return null;
    switch (validation.state) {
      case "ok":
        return { text: t("emailFoundOk", { name: getDisplayName(validation.student) }), color: Colors.primary };
      case "not_found":
        return { text: t("emailNotFoundError"), color: Colors.danger };
      case "wrong_role":
        return { text: t("emailWrongRoleError"), color: Colors.danger };
      case "already_yours":
        return { text: t("emailAlreadyYourStudent"), color: Colors.danger };
      case "has_other_coach":
        return { text: t("emailHasOtherCoach"), color: Colors.danger };
      case "already_invited":
        return { text: t("emailAlreadyInvited"), color: Colors.danger };
      case "cooldown":
        return {
          text: t("emailCooldown", { date: formatDateFull(validation.availableAtMs, locale) }),
          color: Colors.danger,
        };
      default:
        return null;
    }
  })();

  const handleSendInvite = async () => {
    if (!user || user.role !== "coach" || !isOk) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await inviteService.createInvite(user.id, studentEmail.trim());
      setInviteSent(true);
    } catch (e: any) {
      setSubmitError(e?.message ?? t("inviteCreateFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenLayout>
      <KeyboardAwareScrollView
        style={{ flex: 1, backgroundColor: Colors.bg }}
        contentContainerStyle={{
          flexGrow: 1,
          padding: Spacing.md,
          paddingBottom: Spacing.screenBottom,
          backgroundColor: Colors.bg,
        }}
        // Prevent iOS bounce/overscroll revealing white during swipe-back.
        bounces={false}
        alwaysBounceVertical={false}
        // Prevent Android glow/overscroll.
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        enableResetScrollToCoords={false}
        extraScrollHeight={24}
      >
      <View
        style={{
          backgroundColor: Colors.card,
          borderRadius: Radius.md,
          padding: 20,
          marginTop: Spacing.md,
          borderWidth: 1,
          borderColor: Colors.border,
        }}
      >
          <Text
            style={{
              ...Typography.title,
              fontSize: FontSizes.h3,
              marginBottom: Spacing.xs,
            }}
          >
            {t("createStudentTitle")}
          </Text>
          <Text style={{ ...Typography.secondary, marginBottom: Spacing.md }}>
            {t("createStudentSubtitle")}
          </Text>
          <Text style={{ ...Typography.secondary, marginBottom: 6 }}>{t("studentEmailLabel")}</Text>
          <TextInput
            placeholder="student@example.com"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={studentEmail}
            onChangeText={setStudentEmail}
            editable={!inviteSent}
            style={{
              borderWidth: 1,
              borderColor: validationMessage ? validationMessage.color : Colors.border,
              padding: 12,
              borderRadius: Radius.sm,
              marginBottom: 4,
              color: Colors.text,
              backgroundColor: Colors.surface,
              opacity: inviteSent ? 0.6 : 1,
            }}
          />
          {validation.status === "checking" ? (
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.sm, fontSize: FontSizes.tiny }}>
              …
            </Text>
          ) : validationMessage ? (
            <Text style={{ color: validationMessage.color, marginBottom: Spacing.sm, fontSize: FontSizes.tiny, fontWeight: "600" }}>
              {validationMessage.text}
            </Text>
          ) : (
            <Text style={{ ...Typography.secondary, marginBottom: Spacing.md }}>
              {t("studentEmailHint")}
            </Text>
          )}

          {inviteSent ? (
            <PrimaryButton
              title={t("doneButton")}
              onPress={() => router.replace("/coach/dashboard")}
            />
          ) : submitting ? (
            <ActivityIndicator style={{ marginVertical: 12 }} color={Colors.primary} />
          ) : (
            <>
              <PrimaryButton
                title={isOk ? t("sendInviteButton") : t("linkStudentButton")}
                onPress={handleSendInvite}
                disabled={!isOk}
              />
              <View style={{ marginTop: Spacing.sm }}>
                <PrimaryButton
                  title={t("cancelButton")}
                  onPress={() => router.back()}
                  style={{ backgroundColor: Colors.border }}
                />
              </View>
            </>
          )}
          {submitError ? (
            <Text style={{ color: Colors.danger, marginTop: Spacing.xs }}>{submitError}</Text>
          ) : null}
      </View>

      {inviteSent ? (
        <View
          style={{
            backgroundColor: Colors.primaryTint,
            borderRadius: Radius.md,
            padding: 12,
            marginTop: Spacing.sm,
            flexDirection: "row",
            alignItems: "center",
            gap: Spacing.sm,
          }}
        >
          <Text style={{ fontSize: 20 }}>📨</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors.primary, fontSize: FontSizes.note, fontWeight: "700" }}>
              {t("invitePendingTitle")}
            </Text>
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>
              {t("invitePendingSubtitle")}
            </Text>
          </View>
        </View>
      ) : null}
      </KeyboardAwareScrollView>
    </ScreenLayout>
  );
}
