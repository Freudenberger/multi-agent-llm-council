export type ProviderId = "openrouter";

export type ProviderSetting = {
  apiKey: string;
};

export type ProviderSettings = {
  [providerId: string]: ProviderSetting;
};

export type User = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
  /** Per-provider API key settings. Keyed by provider id (e.g. "openrouter"). */
  providerSettings?: ProviderSettings;
  /**
   * User's preferred model identifiers (an allow-list, order-independent).
   * e.g. ["openrouter/free", "anthropic/claude-sonnet-4-20250514"]
   *
   * When non-empty:
   * - every council agent that has no explicit per-agent override is assigned a
   *   model picked at random from this list (independently per agent), so a user
   *   can constrain which models run without customizing each agent in each mode
   *   — pick one model to run everything on it, or several to spread across them;
   * - the AgentCustomizer per-agent model dropdown is restricted to this list.
   *
   * It's a user-level override that works across all modes.
   */
  preferredModels?: string[];
};

export type UserPublic = {
  id: string;
  email: string;
  name: string;
};

/**
 * User storage interface.
 * Implementations: localUserStorage (JSON file) and supabaseUserStorage (PostgreSQL).
 * Selected at runtime by the DB_PROVIDER env var (see ./userStorage).
 */
export type UserStorage = {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(user: User): Promise<void>;
  getAll(): Promise<User[]>;
  updateProviderSettings(
    userId: string,
    providerSettings: ProviderSettings,
  ): Promise<User | null>;
  updatePreferredModels(
    userId: string,
    preferredModels: string[],
  ): Promise<User | null>;
};
