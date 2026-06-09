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
};

export type UserPublic = {
  id: string;
  email: string;
  name: string;
};
