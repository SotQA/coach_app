import { Linking } from "react-native";
import { getLocales } from "expo-localization";
import type { MessengerType } from "../types/User";

/** ISO region code -> international calling code, for the WhatsApp field's default prefix. */
const DIAL_CODES: Record<string, string> = {
  US: "1", CA: "1", GB: "44", IE: "353", PL: "48", DE: "49", FR: "33", ES: "34",
  IT: "39", PT: "351", NL: "31", BE: "32", CH: "41", AT: "43", SE: "46", NO: "47",
  FI: "358", DK: "45", CZ: "420", SK: "421", RO: "40", HU: "36", BG: "359",
  HR: "385", LT: "370", LV: "371", EE: "372", GR: "30", TR: "90", UA: "380",
  RU: "7", BY: "375", IN: "91", CN: "86", JP: "81", KR: "82", BR: "55", MX: "52",
  AU: "61", NZ: "64", IL: "972", ZA: "27",
};

const DEFAULT_REGION = "PL";

export interface DefaultDialCode {
  regionCode: string;
  dialCode: string; // no leading "+"
  flag: string;
}

/** Two-letter region code -> flag emoji via regional indicator symbols. */
export function getFlagEmoji(regionCode: string): string {
  const code = regionCode.trim().toUpperCase();
  if (code.length !== 2) return "🏳️";
  const points = [...code].map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...points);
}

/** Detects the device's region and returns its dial code, defaulting to PL/+48. */
export function getDefaultDialCode(): DefaultDialCode {
  let regionCode = DEFAULT_REGION;
  try {
    const detected = getLocales()[0]?.regionCode;
    if (detected && DIAL_CODES[detected.toUpperCase()]) {
      regionCode = detected.toUpperCase();
    }
  } catch {
    // Keep default region on any locale lookup failure.
  }
  return {
    regionCode,
    dialCode: DIAL_CODES[regionCode] ?? DIAL_CODES[DEFAULT_REGION],
    flag: getFlagEmoji(regionCode),
  };
}

export type ValidationResult =
  | { valid: true; value: string }
  | { valid: false; error: string };

const TELEGRAM_RE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

/** Strips a leading "@", then validates: starts with a letter, 5-32 chars, letters/numbers/underscores. */
export function validateTelegramHandle(raw: string): ValidationResult {
  const stripped = raw.trim().replace(/^@+/, "");
  if (!TELEGRAM_RE.test(stripped)) {
    return { valid: false, error: "errorTelegramHandleInvalid" };
  }
  return { valid: true, value: stripped };
}

/**
 * Validates local WhatsApp digits against a dial code: digits only, and the
 * combined (dialCode + local) length must be 7-15 digits (E.164 range).
 * Returns the full "+<dialCode><digits>" value on success.
 */
export function validateWhatsappNumber(dialCode: string, rawLocal: string): ValidationResult {
  const digits = rawLocal.trim().replace(/[^\d]/g, "");
  if (!digits || digits.length !== rawLocal.trim().length) {
    return { valid: false, error: "errorWhatsappDigitsOnly" };
  }
  const totalLength = dialCode.length + digits.length;
  if (totalLength < 7 || totalLength > 15) {
    return { valid: false, error: "errorWhatsappLength" };
  }
  return { valid: true, value: `+${dialCode}${digits}` };
}

/**
 * Resolves the registration/edit-profile messenger form state into a
 * savable contact, or null when the active field was left empty (treated
 * the same as "Skip for now" — the contact is always optional).
 */
export function resolveMessengerContact(
  type: MessengerType,
  telegramInput: string,
  whatsappInput: string
): { error: string | null; contact: { messengerType: MessengerType; messengerHandle: string } | null } {
  if (type === "telegram") {
    if (!telegramInput.trim()) return { error: null, contact: null };
    const result = validateTelegramHandle(telegramInput);
    if (!result.valid) return { error: result.error, contact: null };
    return { error: null, contact: { messengerType: "telegram", messengerHandle: result.value } };
  }
  if (!whatsappInput.trim()) return { error: null, contact: null };
  const dial = getDefaultDialCode();
  const result = validateWhatsappNumber(dial.dialCode, whatsappInput);
  if (!result.valid) return { error: result.error, contact: null };
  return { error: null, contact: { messengerType: "whatsapp", messengerHandle: result.value } };
}

export function messengerDeepLinkUrl(type: MessengerType, handle: string): string {
  if (type === "telegram") {
    return `https://t.me/${handle.replace(/^@+/, "")}`;
  }
  return `https://wa.me/${handle.replace(/^\+/, "")}`;
}

/** In-app custom URL scheme — jumps straight to the chat, skipping the t.me/wa.me web interstitial. */
function messengerNativeSchemeUrl(type: MessengerType, handle: string): string {
  if (type === "telegram") {
    return `tg://resolve?domain=${handle.replace(/^@+/, "")}`;
  }
  return `whatsapp://send?phone=${handle.replace(/^\+/, "")}`;
}

/**
 * Opens a chat directly in the Telegram/WhatsApp app when it's installed
 * (native scheme, no web page in between), falling back to the public
 * https://t.me / wa.me link — which the OS turns into an App/Play Store
 * redirect — when the app isn't installed or the scheme can't be opened.
 */
export async function openMessengerContact(type: MessengerType, handle: string): Promise<void> {
  try {
    await Linking.openURL(messengerNativeSchemeUrl(type, handle));
  } catch {
    await Linking.openURL(messengerDeepLinkUrl(type, handle));
  }
}
