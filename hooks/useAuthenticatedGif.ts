/**
 * useAuthenticatedGif — simplified passthrough.
 *
 * ExerciseDB GIF URLs (https://v2.exercisedb.io/image/exercises/gif/...)
 * are served from a public CDN that does not require auth headers.
 * expo-image can load them directly; no fetch/blob/FileReader dance needed
 * (and FileReader.readAsDataURL is unreliable on React Native / Hermes anyway).
 *
 * This hook is retained for API compatibility but simply returns the original
 * URL so callers can migrate at their own pace.
 */
export function useAuthenticatedGif(gifUrl: string | undefined): {
  localUri: string | null;
  loading: boolean;
} {
  return {
    localUri: gifUrl ?? null,
    loading: false,
  };
}
