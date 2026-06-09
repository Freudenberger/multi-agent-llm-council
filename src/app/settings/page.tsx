"use client";

import { useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ProviderInfo = {
  id: string;
  name: string;
  description: string;
  docsUrl: string;
};

type SettingsResponse = {
  providers: ProviderInfo[];
  settings: Record<string, { apiKey: string }>;
};

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("providers");

  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [savedKeys, setSavedKeys] = useState<Record<string, { apiKey: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Load settings on mount
  useEffect(() => {
    if (!session?.user?.id) return;

    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((data: SettingsResponse) => {
        setProviders(data.providers);
        setSavedKeys(data.settings);
        // Initialize empty input fields
        const keys: Record<string, string> = {};
        for (const p of data.providers) {
          keys[p.id] = "";
        }
        setApiKeys(keys);
      })
      .catch(() => {
        setMessage({ type: "error", text: "Failed to load settings" });
      })
      .finally(() => setLoading(false));
  }, [session?.user?.id]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);

    // Only send providers that have a non-empty key
    const toSave: Record<string, { apiKey: string }> = {};
    for (const [providerId, key] of Object.entries(apiKeys)) {
      if (key.trim()) {
        toSave[providerId] = { apiKey: key.trim() };
      }
    }

    try {
      const res = await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerSettings: toSave }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to save settings" });
        return;
      }

      setMessage({ type: "success", text: "Settings saved successfully" });
      // Clear input fields after save
      const cleared: Record<string, string> = {};
      for (const p of providers) {
        cleared[p.id] = "";
      }
      setApiKeys(cleared);
      // Reload to get updated masked keys
      const reload = await fetch("/api/user/settings");
      const reloadData: SettingsResponse = await reload.json();
      setSavedKeys(reloadData.settings);
    } catch {
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  }, [apiKeys, providers]);

  const handleRemove = useCallback(async (providerId: string) => {
    setMessage(null);
    try {
      const res = await fetch(
        `/api/user/settings?provider=${encodeURIComponent(providerId)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to remove API key" });
        return;
      }
      setMessage({ type: "success", text: "API key removed successfully" });
      // Reload settings to reflect removal
      const reload = await fetch("/api/user/settings");
      const reloadData: SettingsResponse = await reload.json();
      setSavedKeys(reloadData.settings);
    } catch {
      setMessage({ type: "error", text: "Failed to remove API key" });
    }
  }, []);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-zinc-700 border-t-blue-500 animate-spin" />
      </div>
    );
  }

  if (!session?.user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-zinc-400 hover:text-zinc-200 transition-colors">
            ← Back
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-zinc-800 pb-px">
            <TabButton
              active={activeTab === "providers"}
              onClick={() => setActiveTab("providers")}
            >
              API Provider Keys
            </TabButton>
          </div>

          {/* Tab Panels */}
          {activeTab === "providers" && (
            <ProvidersTab
              providers={providers}
              apiKeys={apiKeys}
              savedKeys={savedKeys}
              loading={loading}
              saving={saving}
              message={message}
              onApiKeyChange={(providerId, val) =>
                setApiKeys((prev) => ({ ...prev, [providerId]: val }))
              }              onApiKeyRemove={handleRemove}              onSave={handleSave}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border border-b-0 transition-colors -mb-px ${
        active
          ? "bg-zinc-900 border-zinc-700 text-zinc-100"
          : "border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
      }`}
    >
      {children}
    </button>
  );
}

function ProvidersTab({
  providers,
  apiKeys,
  savedKeys,
  loading,
  saving,
  message,
  onApiKeyChange,
  onApiKeyRemove,
  onSave,
}: {
  providers: ProviderInfo[];
  apiKeys: Record<string, string>;
  savedKeys: Record<string, { apiKey: string }>;
  loading: boolean;
  saving: boolean;
  message: { type: "success" | "error"; text: string } | null;
  onApiKeyChange: (providerId: string, val: string) => void;
  onApiKeyRemove: (providerId: string) => void;
  onSave: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 rounded-full border-4 border-zinc-700 border-t-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-400">
        Configure your own API keys to use your personal LLM provider accounts.
        Keys are stored locally and never shared.
      </p>

      {message && (
        <div
          className={`p-3 rounded-lg border text-sm ${
            message.type === "success"
              ? "bg-green-500/10 border-green-500/30 text-green-300"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {providers.map((provider) => (
          <ProviderKeyCard
            key={provider.id}
            provider={provider}
            savedKey={savedKeys[provider.id]?.apiKey ?? ""}
            value={apiKeys[provider.id] ?? ""}
            onChange={(val) => onApiKeyChange(provider.id, val)}
            onRemove={() => onApiKeyRemove(provider.id)}
          />
        ))}
      </div>

      {providers.length === 0 && (
        <p className="text-sm text-zinc-500">
          No providers available. Check back later.
        </p>
      )}

      {/* Save Button */}
      <div className="flex items-center gap-4 pt-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </span>
          ) : (
            "Save Settings"
          )}
        </button>
        <Link
          href="/"
          className="px-6 py-2.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}

function ProviderKeyCard({
  provider,
  savedKey,
  value,
  onChange,
  onRemove,
}: {
  provider: ProviderInfo;
  savedKey: string;
  value: string;
  onChange: (val: string) => void;
  onRemove: () => void;
}) {
  const [showKey, setShowKey] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const hasExistingKey = savedKey.length > 0;

  // Derive effective confirm state — hide dialog when key is gone
  const showConfirmRemove = confirmRemove && hasExistingKey;

  return (
    <div className="border border-zinc-700 rounded-lg bg-zinc-900 overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="font-semibold text-zinc-100">{provider.name}</h3>
            <p className="text-sm text-zinc-400 mt-0.5">{provider.description}</p>
          </div>
          <div className="flex items-center gap-2">
            {hasExistingKey && (
              <span className="shrink-0 px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/30 rounded-full">
                Configured
              </span>
            )}
            {hasExistingKey && !showConfirmRemove && (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                title="Remove API key"
              >
                ✕ Remove
              </button>
            )}
            {showConfirmRemove && (
              <div className="flex items-center gap-2" id={`confirm-remove-${provider.id}`}>
                <span className="text-xs text-red-400">Remove key?</span>
                <button
                  type="button"
                  onClick={onRemove}
                  className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500/30 transition-colors"
                >
                  Yes, remove
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(false)}
                  className="text-xs px-2 py-0.5 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor={`key-${provider.id}`} className="block text-sm font-medium text-zinc-300">
            API Key
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                id={`key-${provider.id}`}
                type={showKey ? "text" : "password"}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={
                  hasExistingKey
                    ? "Enter new key to replace (leave blank to keep existing)"
                    : "Enter your API key..."
                }
                className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                autoComplete="off"
              />
              {hasExistingKey && !value && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono">
                  {savedKey}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
              title={showKey ? "Hide key" : "Show key"}
            >
              {showKey ? "🙈" : "👁"}
            </button>
          </div>
          {hasExistingKey && (
            <p className="text-xs text-zinc-500">
              Current key: <span className="font-mono">{savedKey}</span>
            </p>
          )}
        </div>

        <div className="mt-3">
          <a
            href={provider.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            How to get an API key →
          </a>
        </div>
      </div>
    </div>
  );
}
