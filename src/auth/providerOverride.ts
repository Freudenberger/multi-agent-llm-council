import type { ProviderOverride } from "@/providers/types";
import type { ProviderSettings } from "./types";

/**
 * Pick a bring-your-own-key override from a signed-in user's saved provider
 * settings: the first provider that has a non-empty API key. Returns undefined
 * when none is configured — the run then uses the env-configured provider.
 *
 * Provider-agnostic: it reads whatever provider ids the user has stored, so a
 * new provider works automatically once it's in `ProviderId` + the provider
 * registry. "First with a key" is unambiguous for the single-provider case
 * today; when users can configure several keys at once, add an explicit
 * "preferred provider" selection and resolve against that instead.
 */
export function resolveProviderOverride(
  settings: ProviderSettings | undefined,
): ProviderOverride | undefined {
  if (!settings) return undefined;
  for (const [providerId, setting] of Object.entries(settings)) {
    const apiKey = setting?.apiKey?.trim();
    if (apiKey) return { providerId, apiKey };
  }
  return undefined;
}
