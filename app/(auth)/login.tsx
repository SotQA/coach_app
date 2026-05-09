import { useState, type ComponentProps, type ReactNode } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Pressable,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { PrimaryButton } from "../../components/PrimaryButton";
import { InputField } from "../../components/InputField";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";
import { Ionicons } from "@expo/vector-icons";
import { logger } from "@/utils/logger";

WebBrowser.maybeCompleteAuthSession();

const H_PAD = 24;
const PRESS_SCALE = 0.97;

/** Local Reanimated spring scale for `Pressable`s on this screen (Google row). */
function TouchScale({
  children,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  accessibilityRole,
  accessibilityLabel,
}: Pick<
  ComponentProps<typeof Pressable>,
  "disabled" | "onPress" | "onPressIn" | "onPressOut" | "accessibilityRole" | "accessibilityLabel"
> & {
  children: ReactNode;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      onPressIn={(e) => {
        if (!disabled) scale.value = withSpring(PRESS_SCALE);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1);
        onPressOut?.(e);
      }}
      style={{ width: "100%" }}
    >
      <Animated.View style={[{ width: "100%" }, animStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

export default function Login() {
  const router = useRouter();
  const { user, loading: authLoading, login, loginWithGoogleIdToken } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const extra = (Constants.expoConfig as { extra?: Record<string, unknown> })?.extra ?? {};
  const googleWebClientId = String(extra.googleWebClientId ?? "").trim();
  const googleIosClientId = String(extra.googleIosClientId ?? "").trim();
  const googleAndroidClientId = String(extra.googleAndroidClientId ?? "").trim();

  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  const webGoogleRedirectUri =
    Platform.OS === "web" ? makeRedirectUri({ path: "oauthredirect" }) : "";

  if (__DEV__ && Platform.OS === "web" && webGoogleRedirectUri) {
    logger.log(
      "[login] Web only — add this URI to Google Cloud → Web client → Authorized redirect URIs:",
      webGoogleRedirectUri
    );
  }

  const [request, , promptAsync] = Google.useIdTokenAuthRequest(
    Platform.OS === "web"
      ? {
          webClientId: googleWebClientId || undefined,
          redirectUri: webGoogleRedirectUri,
        }
      : {
          webClientId: googleWebClientId || undefined,
          iosClientId: Platform.OS === "ios" ? googleIosClientId || undefined : undefined,
          androidClientId:
            Platform.OS === "android" ? googleAndroidClientId || undefined : undefined,
          clientId:
            Platform.OS === "android" && !googleAndroidClientId
              ? googleWebClientId || undefined
              : undefined,
        },
    Platform.OS === "web" ? { path: "oauthredirect" } : {}
  );

  const googleNativeConfigured =
    Platform.OS === "web" ||
    (Platform.OS === "ios" && !!googleIosClientId) ||
    (Platform.OS === "android" && !!googleAndroidClientId);

  const googleButtonEnabled =
    !!googleWebClientId && googleNativeConfigured && !isExpoGo && !!request;

  const handleLogin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setError(e.message ?? t("failedToLogin"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      if (!googleWebClientId) {
        throw new Error(
          "Google Sign-In is not configured. Set expo.extra.googleWebClientId in app.json (Web client ID from Google Cloud / Firebase)."
        );
      }
      if (isExpoGo) {
        throw new Error(
          "Google sign-in does not work in Expo Go (Google only allows http(s) redirects on the Web client). Use a development build: npx expo run:ios or npx expo run:android."
        );
      }
      if (Platform.OS === "ios" && !googleIosClientId) {
        throw new Error("Set expo.extra.googleIosClientId in app.json (iOS OAuth client from Google Cloud).");
      }
      if (Platform.OS === "android" && !googleAndroidClientId) {
        throw new Error(
          "Set expo.extra.googleAndroidClientId in app.json (Android OAuth client with your package name and SHA-1)."
        );
      }
      setGoogleSubmitting(true);
      const res = await promptAsync();
      if (res.type !== "success") {
        if (res.type === "dismiss" || res.type === "cancel") return;
        throw new Error("Google sign-in was not completed.");
      }

      const idToken = (res.params as any)?.id_token as string | undefined;
      if (!idToken) {
        throw new Error("Google sign-in did not return an ID token.");
      }

      await loginWithGoogleIdToken({ idToken });
    } catch (e: any) {
      console.error("[login] google sign-in error", e);
      setError(e.message ?? "Google sign-in failed.");
    } finally {
      setGoogleSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (user) return null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flex: 1 }} />

        <View style={{ paddingHorizontal: H_PAD, paddingBottom: Spacing.screenBottom }}>
          <Text style={{ ...Typography.display, color: Colors.primary, letterSpacing: -1.5 }}>Mentorix</Text>
          <Text style={{ ...Typography.micro, color: Colors.textMuted, marginTop: Spacing.xs }}>
            Coach. Train. Progress.
          </Text>

          <Text style={{ ...Typography.display, marginTop: Spacing.lg }}>{t("welcomeBack")}</Text>
          <Text style={{ ...Typography.body, color: Colors.textMuted, marginTop: Spacing.xs }}>
            {t("loginSubtitle")}
          </Text>

          <View style={{ marginTop: Spacing.lg }}>
            <View style={{ marginBottom: Spacing.sm }}>
              <InputField
                label={t("email")}
                value={email}
                onChangeText={setEmail}
                placeholder={t("emailPlaceholder")}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>
            <InputField
              label={t("password")}
              value={password}
              onChangeText={setPassword}
              placeholder={t("passwordPlaceholder")}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          <View style={{ marginTop: Spacing.lg, gap: Spacing.md }}>
            <PrimaryButton title={t("login")} onPress={handleLogin} loading={submitting} />

            <TouchScale
              disabled={googleSubmitting || submitting || !googleButtonEnabled}
              onPress={handleGoogleLogin}
              accessibilityRole="button"
              accessibilityLabel={t("continueWithGoogle")}
            >
              <View
                style={{
                  borderRadius: Radius.lg,
                  paddingVertical: 15,
                  paddingHorizontal: Spacing.md,
                  borderWidth: 1.5,
                  borderColor:
                    googleButtonEnabled && !googleSubmitting && !submitting
                      ? Colors.primary
                      : Colors.disabled,
                  backgroundColor: "transparent",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  minHeight: 50,
                }}
              >
                {googleSubmitting ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : (
                  <>
                    <Ionicons
                      name="logo-google"
                      size={18}
                      color={
                        googleButtonEnabled && !submitting ? Colors.primary : Colors.textMuted
                      }
                    />
                    <Text
                      style={{
                        ...Typography.section,
                        color:
                          googleButtonEnabled && !submitting ? Colors.primary : Colors.textMuted,
                        textAlign: "center",
                      }}
                    >
                      {t("continueWithGoogle")}
                    </Text>
                  </>
                )}
              </View>
            </TouchScale>

            <PrimaryButton
              title={t("createAccount")}
              variant="secondary"
              disabled={submitting || googleSubmitting}
              onPress={() => router.push("/signup")}
            />
          </View>

          {isExpoGo ? (
            <Text style={{ ...Typography.secondary, marginTop: Spacing.md, fontSize: FontSizes.caption }}>
              Google sign-in requires a dev build (Expo Go cannot register the redirect URI Google accepts).
            </Text>
          ) : null}
          {!isExpoGo && Platform.OS === "android" && !googleAndroidClientId ? (
            <Text style={{ ...Typography.secondary, marginTop: Spacing.xs, fontSize: FontSizes.caption }}>
              Add an Android OAuth client ID in app.json to use Google on Android.
            </Text>
          ) : null}

          {error ? (
            <Text style={{ color: Colors.danger, marginTop: Spacing.md }}>{error}</Text>
          ) : null}
        </View>

        <View style={{ flex: 1 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
