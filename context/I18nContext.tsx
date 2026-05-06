import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { i18n } from "../i18n";

// ─── Supported locales ────────────────────────────────────────────────────────

export const SUPPORTED_LOCALES = ["en", "pl", "ru"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: "English",
  pl: "Polski",
  ru: "Русский",
};

const LOCALE_STORAGE_KEY = "app_locale";

// ─── Context shape ────────────────────────────────────────────────────────────

interface I18nContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => Promise<void>;
  /**
   * Translate a key. Supports i18n-js interpolation with `%{variable}`.
   *
   * Returns the key itself (never throws) when the key is missing, so
   * missing translations degrade gracefully to the raw key string.
   */
  t: (key: string, options?: Record<string, unknown>) => string;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>("en");

  // ── Hydrate: saved language → device language → "en" ─────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const saved = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
        if (saved && SUPPORTED_LOCALES.includes(saved as SupportedLocale)) {
          setLocaleState(saved as SupportedLocale);
          return;
        }
        const deviceLang = getLocales()[0]?.languageCode ?? "en";
        const detected = SUPPORTED_LOCALES.includes(deviceLang as SupportedLocale)
          ? (deviceLang as SupportedLocale)
          : "en";
        setLocaleState(detected);
      } catch {
        // Keep default "en" on storage/locale error
      }
    };
    init();
  }, []);

  // ── setLocale: update state + persist ─────────────────────────────────────
  const setLocale = useCallback(async (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    try {
      await AsyncStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
    } catch {
      // Non-critical — UI is already updated
    }
  }, []);

  // ── t: safe translate with fallback to key ────────────────────────────────
  const t = useCallback(
    (key: string, options?: Record<string, unknown>): string => {
      try {
        const result = i18n.t(key, { locale, defaultValue: key, ...options });
        return typeof result === "string" ? result : key;
      } catch {
        return key;
      }
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
