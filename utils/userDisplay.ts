/**
 * Helpers for displaying user names and initials.
 * Accepts any object with optional firstName/lastName/email fields so it
 * works with AppUser, StudentSummary, or any similar shape without requiring
 * changes to those types.
 */

type UserLike = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

/**
 * Returns up to two uppercase initials from the user's first and last name.
 * Falls back to the first character of email (uppercased), then to `fallback`.
 */
export function getUserInitials(u: UserLike | null | undefined, fallback = "?"): string {
  if (!u) return fallback;
  const a = u.firstName?.trim()?.[0] ?? "";
  const b = u.lastName?.trim()?.[0] ?? "";
  const s = `${a}${b}`.toUpperCase();
  if (s) return s;
  const e = u.email?.trim()?.[0]?.toUpperCase();
  return e || fallback;
}

/**
 * Returns "First Last" trimmed, with whitespace collapsed.
 * Falls back to email, then to `fallback` (default "—").
 */
export function getDisplayName(u: UserLike | null | undefined, fallback = "—"): string {
  if (!u) return fallback;
  const n = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  if (n) return n;
  return u.email?.trim() || fallback;
}
