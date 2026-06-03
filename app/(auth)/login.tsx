import { useState, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
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
// Lazy-load the native Google Sign-In module. TurboModuleRegistry.getEnforcing()
// is called at require() time and throws if the native binary was built without
// the module (e.g. an OTA update on top of an older build). Wrapping in try/catch
// lets the app run and show a graceful error instead of crashing.
let _googleSigninModule: typeof import("@react-native-google-signin/google-signin") | null = null;
try {
  _googleSigninModule = require("@react-native-google-signin/google-signin");
} catch {
  _googleSigninModule = null;
}
const GoogleSignin = _googleSigninModule?.GoogleSignin ?? null;
const statusCodes = _googleSigninModule?.statusCodes ?? {};
import Constants from "expo-constants";
import { NeedsOnboardingError } from "../../context/AuthContext";
import { PrimaryButton } from "../../components/PrimaryButton";
import { InputField } from "../../components/InputField";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";
import { Ionicons } from "@expo/vector-icons";

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
  const { user, loading: authLoading, login, loginWithGoogleIdToken, pendingGoogleUser } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const extra = (Constants.expoConfig as { extra?: Record<string, unknown> })?.extra ?? {};
  const googleWebClientId = String(extra.googleWebClientId ?? "").trim();
  const googleIosClientId = String(extra.googleIosClientId ?? "").trim();

  useEffect(() => {
    if (Platform.OS !== "web" && googleWebClientId && GoogleSignin) {
      GoogleSignin.configure({
        webClientId: googleWebClientId,
        iosClientId: Platform.OS === "ios" && googleIosClientId ? googleIosClientId : undefined,
      });
    }
  }, [googleWebClientId, googleIosClientId]);

  const googleButtonEnabled = Platform.OS !== "web" && !!googleWebClientId && !!GoogleSignin;

  // Navigate to the role picker only after pendingGoogleUser is committed to context state.
  // Navigating inside the catch block races the setState and can arrive before the state
  // update is applied, causing google-role.tsx to see null and redirect back to login.
  const didPushGoogleRole = useRef(false);
  useEffect(() => {
    if (pendingGoogleUser && !didPushGoogleRole.current) {
      didPushGoogleRole.current = true;
      router.push("/google-role");
    }
    if (!pendingGoogleUser) {
      didPushGoogleRole.current = false;
    }
  }, [pendingGoogleUser, router]);

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
    setGoogleSubmitting(true);
    try {
      if (!GoogleSignin) {
        throw new Error("Google Sign-In is not available in this build. Please update the app.");
      }
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      if (!idToken) {
        throw new Error("Google sign-in did not return an ID token.");
      }
      await loginWithGoogleIdToken({ idToken });
    } catch (e: any) {
      if (e.code === (statusCodes as any).SIGN_IN_CANCELLED) return;
      if (e instanceof NeedsOnboardingError) {
        // Navigation is handled by the useEffect watching pendingGoogleUser.
        return;
      }
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

          {error ? (
            <Text style={{ color: Colors.danger, marginTop: Spacing.md }}>{error}</Text>
          ) : null}
        </View>

        <View style={{ flex: 1 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
