import { useState } from "react";
import { View, Text, TextInput, ActivityIndicator, Pressable, Platform } from "react-native";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { PrimaryButton } from "../../components/PrimaryButton";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { Ionicons } from "@expo/vector-icons";
import { logger } from "@/utils/logger";

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const router = useRouter();
  const { user, loading: authLoading, login, loginWithGoogleIdToken } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const extra = (Constants.expoConfig as any)?.extra ?? {};
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
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        padding: Spacing.lg,
        paddingBottom: 48,
      }}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      enableResetScrollToCoords={false}
      extraScrollHeight={24}
    >
      <View
        style={{
          backgroundColor: Colors.card,
          borderRadius: Radius.md,
          padding: Spacing.lg,
          borderWidth: 1,
          borderColor: Colors.border,
        }}
      >
        <Text style={{ ...Typography.title, marginBottom: Spacing.xs }}>{t("welcomeBack")}</Text>
        <Text style={{ ...Typography.secondary, marginBottom: Spacing.lg }}>
          {t("loginSubtitle")}
        </Text>

        <Text style={{ ...Typography.secondary, marginBottom: 6 }}>{t("email")}</Text>
        <TextInput
          placeholder={t("emailPlaceholder")}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={{
            borderWidth: 1,
            borderColor: Colors.border,
            borderRadius: Radius.sm,
            marginBottom: Spacing.sm,
            padding: 12,
            color: Colors.text,
            backgroundColor: Colors.surface,
          }}
        />

        <Text style={{ ...Typography.secondary, marginBottom: 6 }}>{t("password")}</Text>
        <TextInput
          placeholder={t("passwordPlaceholder")}
          placeholderTextColor={Colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={{
            borderWidth: 1,
            borderColor: Colors.border,
            borderRadius: Radius.sm,
            marginBottom: Spacing.md,
            padding: 12,
            color: Colors.text,
            backgroundColor: Colors.surface,
          }}
        />

        {submitting ? (
          <ActivityIndicator style={{ marginVertical: 12 }} />
        ) : (
          <>
            <PrimaryButton title={t("login")} onPress={handleLogin} />
            <Pressable
              disabled={googleSubmitting || !googleButtonEnabled}
              onPress={handleGoogleLogin}
              style={({ pressed }) => ({
                marginTop: Spacing.sm,
                paddingVertical: 14,
                paddingHorizontal: Spacing.md,
                borderRadius: Radius.md,
                backgroundColor: Colors.surface,
                borderWidth: 1,
                borderColor: Colors.border,
                opacity: pressed ? 0.9 : 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              })}
            >
              {googleSubmitting ? (
                <ActivityIndicator />
              ) : (
                <>
                  <Ionicons name="logo-google" size={18} color={Colors.text} />
                  <Text style={{ ...Typography.section, color: Colors.text }}>
                    {t("continueWithGoogle")}
                  </Text>
                </>
              )}
            </Pressable>
            {isExpoGo ? (
              <Text style={{ ...Typography.secondary, marginTop: Spacing.xs, fontSize: 12 }}>
                Google sign-in requires a dev build (Expo Go cannot register the redirect URI Google accepts).
              </Text>
            ) : null}
            {!isExpoGo && Platform.OS === "android" && !googleAndroidClientId ? (
              <Text style={{ ...Typography.secondary, marginTop: Spacing.xs, fontSize: 12 }}>
                Add an Android OAuth client ID in app.json to use Google on Android.
              </Text>
            ) : null}
            <PrimaryButton
              title={t("createAccount")}
              onPress={() => router.push("/signup")}
              style={{ marginTop: Spacing.sm, backgroundColor: Colors.border }}
            />
          </>
        )}

        {error ? (
          <Text style={{ color: Colors.danger, marginTop: Spacing.xs }}>{error}</Text>
        ) : null}
      </View>
    </KeyboardAwareScrollView>
  );
}
