import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { Platform } from "react-native";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAV9aev_MqnIgDhIrV3t4roHmHVREv5Moc",
  authDomain: "gym-coach-app-3a18a.firebaseapp.com",
  projectId: "gym-coach-app-3a18a",
  storageBucket: "gym-coach-app-3a18a.firebasestorage.app",
  messagingSenderId: "915193499412",
  appId: "1:915193499412:web:74956934752ed456d07c01",
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// App Check (only on web; native uses a separate path via expo-app-check or
// react-native-firebase if added later).
if (Platform.OS === "web" && typeof window !== "undefined") {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(
        process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY ?? ""
      ),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    // Non-fatal: App Check failure must not prevent app boot.
    console.warn("[firebase] App Check init failed", e);
  }
}

/**
 * Persist auth session on iOS/Android (AsyncStorage). Web uses default browser persistence.
 */
function createAuth() {
  if (Platform.OS === "web") {
    return getAuth(app);
  }
  try {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    const { initializeAuth, getReactNativePersistence } = require("firebase/auth");
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
}

export const auth = createAuth();
export const db = getFirestore(app);
export const storage = getStorage(app);
