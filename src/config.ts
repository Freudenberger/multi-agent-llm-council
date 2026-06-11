/**
 * Global configuration values for the LLM Council application.
 *
 * Keeping magic numbers (like the maximum number of conversations per user)
 * in a single place makes them easy to adjust, document, and override via
 * environment variables when needed.
 */

/**
 * Maximum number of stored conversations per user.
 * Default is 5 to match the existing behaviour.
 */
export const MAX_CONVERSATIONS_PER_USER = 5;
