// ============================================
// Infinite Loop Protection — Bot Detection
// ============================================
// Prevents infinite loops where the bot commits
// a fix → triggers a new workflow → which fails
// → triggers another fix, ad infinitum.
// ============================================

/** Well-known bot login suffixes and names. */
const BOT_PATTERNS: readonly string[] = [
  "[bot]",
  "github-actions",
  "dependabot",
  "renovate",
];

/**
 * Checks if the sender is a bot account.
 *
 * @param login - The `sender.login` from
 *   the webhook payload
 * @returns true if the sender appears to be
 *   a bot (should skip processing)
 */
export function isBotSender(login: string): boolean {
  const lower = login.toLowerCase();
  return BOT_PATTERNS.some(
    (pattern) => lower.endsWith(pattern) || lower === pattern,
  );
}
