"use client";

import { useState, useCallback, useRef } from "react";
import type { CouncilAgent, CustomAgent } from "@/core/types";
import type { AgentTemplateInfo } from "@/app/agentData";

export type ModelInfo = {
  id: string;
  name: string;
};

export type AgentCustomizerProps = {
  /** The default agents for the currently selected mode. */
  defaultAgents: CouncilAgent[];
  /** All available agent templates across every council mode (deduplicated). */
  allTemplates: AgentTemplateInfo[];
  /** Callback when the user saves their customizations. */
  onChange: (customAgents: Record<string, CustomAgent>) => void;
  /** Available free models from OpenRouter. */
  availableModels?: ModelInfo[];
};

/**
 * Allows users to customize council agents by picking from predefined templates
 * or editing agent data (name, role, system prompt) directly.
 */
export function AgentCustomizer({ defaultAgents, allTemplates, onChange, availableModels = [] }: AgentCustomizerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [customAgents, setCustomAgents] = useState<Record<string, CustomAgent>>({});
  const [showTemplatePicker, setShowTemplatePicker] = useState<string | null>(null);
  // Snapshot of agent state when editing starts — used by Cancel to revert
  const editSnapshot = useRef<Record<string, CustomAgent>>({});

  const handleStartEditing = useCallback(
    (agentId: string) => {
      setEditingAgentId(agentId);
      setShowTemplatePicker(null);
      // Snapshot current custom agents so Cancel can revert
      editSnapshot.current = { ...customAgents };
    },
    [customAgents],
  );

  const handleCancelEditing = useCallback(
    (agentId: string) => {
      // Revert to snapshot taken when editing started
      const snapshot = editSnapshot.current;
      // If the agent was not customized before editing, remove it from customAgents
      // If it was customized, restore the snapshot version
      setCustomAgents((prev) => {
        const beforeEdit = snapshot;
        const agentDefault = defaultAgents.find((a) => a.id === agentId);
        const wasCustomizedBefore = !!beforeEdit[agentId];

        if (!wasCustomizedBefore && !agentDefault) {
          // Agent didn't exist before, remove any edits
          const next = { ...prev };
          delete next[agentId];
          onChange(next);
          return next;
        }

        if (!wasCustomizedBefore && agentDefault) {
          // Agent was using defaults, remove from customAgents to restore default
          const next = { ...prev };
          delete next[agentId];
          onChange(next);
          return next;
        }

        // Agent was customized before editing, restore snapshot
        const next = { ...prev, [agentId]: beforeEdit[agentId] };
        onChange(next);
        return next;
      });

      setEditingAgentId(null);
      setShowTemplatePicker(null);
    },
    [defaultAgents, onChange],
  );

  const getEffectiveAgent = useCallback(
    (agentId: string) => {
      if (customAgents[agentId]) return customAgents[agentId];
      const base = defaultAgents.find((a) => a.id === agentId);
      return base ?? null;
    },
    [customAgents, defaultAgents],
  );

  const isAgentCustomized = useCallback(
    (agentId: string) => {
      return !!customAgents[agentId];
    },
    [customAgents],
  );

  const isAgentDisabled = useCallback(
    (agentId: string) => {
      const effective = getEffectiveAgent(agentId);
      if (!effective) return false;
      return effective.disabled === true;
    },
    [getEffectiveAgent],
  );

  const handleToggleDisabled = useCallback(
    (agentId: string) => {
      setCustomAgents((prev) => {
        const current =
          prev[agentId] ?? defaultAgents.find((a) => a.id === agentId)!;
        const next = {
          ...current,
          disabled: current.disabled !== true,
        };
        const updated = { ...prev, [agentId]: next };
        onChange(updated);
        return updated;
      });
    },
    [defaultAgents, onChange],
  );

  const handleFieldChange = useCallback(
    (agentId: string, field: keyof CustomAgent, value: string | boolean) => {
      setCustomAgents((prev) => {
        const current = prev[agentId] ?? defaultAgents.find((a) => a.id === agentId)!;
        const next = { ...current, [field]: value };
        const updated = { ...prev, [agentId]: next };
        onChange(updated);
        return updated;
      });
    },
    [defaultAgents, onChange],
  );

  const handleResetAgent = useCallback(
    (agentId: string) => {
      setCustomAgents((prev) => {
        const next = { ...prev };
        delete next[agentId];
        onChange(next);
        return next;
      });
      setEditingAgentId(null);
    },
    [onChange],
  );

  const handleResetAll = useCallback(() => {
    setCustomAgents({});
    onChange({});
    setEditingAgentId(null);
  }, [onChange]);

  const handlePickTemplate = useCallback(
    (agentId: string, templateId: string) => {
      const template = allTemplates.find((t) => t.id === templateId);
      if (!template) return;
      setCustomAgents((prev) => {
        const next = {
          ...prev,
          [agentId]: { ...template },
        };
        onChange(next);
        return next;
      });
      setShowTemplatePicker(null);
    },
    [allTemplates, onChange],
  );

  const customizedCount = Object.keys(customAgents).length;

  // Compute effective active agents (not disabled) and judge count
  const activeAgents = defaultAgents.filter(
    (agent) => !isAgentDisabled(agent.id),
  );
  const activeCount = activeAgents.length;
  const disabledCount = defaultAgents.length - activeCount;

  const judgeCount = activeAgents.filter((agent) => {
    const effective = getEffectiveAgent(agent.id);
    return effective?.isFinalJudge === true;
  }).length;

  return (
    <div className="border border-zinc-700 rounded-lg bg-zinc-900 overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🎛️</span>
          <div>
            <div className="font-medium text-sm text-zinc-200">Customize Agents</div>
            <div className="text-xs text-zinc-500">
              {activeCount} of {defaultAgents.length} agents active
              {disabledCount > 0 && (
                <span className="text-zinc-600"> · {disabledCount} disabled</span>
              )}
            </div>
          </div>
        </div>
        <span className="text-zinc-400">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="border-t border-zinc-800">
          {/* Reset all */}
          {customizedCount > 0 && (
            <div className="px-4 py-2 border-b border-zinc-800 flex justify-end">
              <button
                onClick={handleResetAll}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Reset all to defaults
              </button>
            </div>
          )}

          {/* Active count warnings */}
          {activeCount === 0 && (
            <div className="px-4 py-2.5 border-b border-zinc-800 bg-red-500/5">
              <p className="text-xs text-red-400/90 flex items-center gap-1.5">
                <span>⚠</span>
                All agents are disabled. Enable at least one agent to run the council.
              </p>
            </div>
          )}
          {activeCount === 1 && (
            <div className="px-4 py-2.5 border-b border-zinc-800 bg-amber-500/5">
              <p className="text-xs text-amber-400/90 flex items-center gap-1.5">
                <span>⚠</span>
                Only 1 agent active. A council with a single perspective provides limited analysis.
              </p>
            </div>
          )}

          {/* Judge warnings */}
          {activeCount >= 2 && judgeCount === 0 && (
            <div className="px-4 py-2.5 border-b border-zinc-800 bg-amber-500/5">
              <p className="text-xs text-amber-400/90 flex items-center gap-1.5">
                <span>⚠</span>
                No judge agent selected. The council will run in specialist-only mode with a fallback summary (no synthesis).
              </p>
            </div>
          )}
          {judgeCount > 1 && (
            <div className="px-4 py-2.5 border-b border-zinc-800 bg-orange-500/5">
              <p className="text-xs text-orange-400/90 flex items-center gap-1.5">
                <span>⚠</span>
                {judgeCount} judges selected. Only the first one will run as the final synthesizer; the others will be treated as specialists.
              </p>
            </div>
          )}

          {/* Agent list */}
          <div className="divide-y divide-zinc-800">
            {defaultAgents.map((agent) => {
              const effective = getEffectiveAgent(agent.id);
              const customized = isAgentCustomized(agent.id);
              const disabled = isAgentDisabled(agent.id);
              const isEditing = editingAgentId === agent.id;
              const isPickerOpen = showTemplatePicker === agent.id;

              return (
                <div
                  key={agent.id}
                  className={`px-4 py-3 transition-opacity ${disabled ? "opacity-40" : "opacity-100"}`}
                >
                  {/* Agent row */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium truncate ${disabled ? "text-zinc-500 line-through" : "text-zinc-200"}`}
                        >
                          {effective?.name ?? agent.name}
                        </span>
                        {!disabled && effective?.isFinalJudge && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 shrink-0">
                            Judge
                          </span>
                        )}
                        {customized && !disabled && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 shrink-0">
                            Custom
                          </span>
                        )}
                        {effective?.model && !disabled && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 shrink-0" title={effective.model}>
                            {effective.model.split("/").pop()}
                          </span>
                        )}
                        {disabled && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-500 shrink-0">
                            Off
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">
                        {effective?.role ?? agent.role}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Enable/disable toggle */}
                      <button
                        onClick={() => handleToggleDisabled(agent.id)}
                        className={`relative w-9 h-5 rounded-full transition-colors ${disabled ? "bg-zinc-700" : "bg-blue-600"}`}
                        title={disabled ? "Enable agent" : "Disable agent"}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${disabled ? "translate-x-0" : "translate-x-4"}`}
                        />
                      </button>
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleCancelEditing(agent.id)}
                            className="px-2 py-1 text-xs rounded border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              setEditingAgentId(null);
                              setShowTemplatePicker(null);
                            }}
                            className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEditing(agent.id)}
                          className="px-2 py-1 text-xs rounded border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Template picker */}
                  {isPickerOpen && (
                    <div className="mt-3 p-3 border border-zinc-700 rounded-lg bg-zinc-800/50">
                      <p className="text-xs text-zinc-400 mb-2">
                        Pick a predefined agent to replace this slot:
                      </p>
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {allTemplates.map((t) => {
                          const isCurrent = t.id === agent.id;
                          const sourceLabel = t.sourceModes.length > 0
                            ? t.sourceModes.join(", ")
                            : null;
                          return (
                            <button
                              key={t.id}
                              onClick={() => handlePickTemplate(agent.id, t.id)}
                              className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
                                isCurrent
                                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                  : "hover:bg-zinc-700 text-zinc-300 border border-transparent"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">{t.name}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {t.isFinalJudge && (
                                    <span className="text-[10px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-400">
                                      Judge
                                    </span>
                                  )}
                                  {sourceLabel && !isCurrent && (
                                    <span className="text-[10px] text-zinc-600">
                                      {sourceLabel}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-zinc-500 mt-0.5 truncate">{t.role}</div>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => setShowTemplatePicker(null)}
                        className="mt-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Edit form */}
                  {isEditing && (
                    <div className="mt-3 space-y-3">

                      {/* Pick from template button */}
                      <button
                        onClick={() => {
                          setShowTemplatePicker(isPickerOpen ? null : agent.id);
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        📋 Pick from predefined agents
                      </button>

                      {/* Name */}
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">
                          Agent Name
                        </label>
                        <input
                          type="text"
                          value={effective?.name ?? ""}
                          onChange={(e) => handleFieldChange(agent.id, "name", e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g., Optimist"
                        />
                      </div>

                      {/* Role */}
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">
                          Role
                        </label>
                        <input
                          type="text"
                          value={effective?.role ?? ""}
                          onChange={(e) => handleFieldChange(agent.id, "role", e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g., Finds useful opportunities"
                        />
                      </div>

                      {/* Model */}
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">
                          Model
                        </label>
                        {availableModels.length > 0 ? (
                          <select
                            value={effective?.model ?? ""}
                            onChange={(e) => handleFieldChange(agent.id, "model", e.target.value)}
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">Default (openrouter/free)</option>
                            {availableModels.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={effective?.model ?? ""}
                              onChange={(e) => handleFieldChange(agent.id, "model", e.target.value)}
                              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                              placeholder="openrouter/free"
                            />

                          </div>
                        )}
                        <p className="text-[10px] text-zinc-600 mt-1">
                          Leave empty to use the default model for all agents.
                        </p>
                      </div>

                      {/* System Prompt */}
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">
                          System Prompt
                        </label>
                        <textarea
                          value={effective?.systemPrompt ?? ""}
                          onChange={(e) => handleFieldChange(agent.id, "systemPrompt", e.target.value)}
                          rows={6}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent resize-y font-mono"
                          placeholder="Define the agent's perspective and instructions..."
                        />
                      </div>

                      {/* Bottom: Reset / Cancel / Save */}
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          {customized && (
                            <button
                              onClick={() => handleResetAgent(agent.id)}
                              className="text-xs text-red-400/70 hover:text-red-400 transition-colors"
                            >
                              ↺ Reset to default
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCancelEditing(agent.id)}
                            className="px-3 py-1.5 text-xs font-medium rounded border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              setEditingAgentId(null);
                              setShowTemplatePicker(null);
                            }}
                            className="px-3 py-1.5 text-xs font-medium rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
