"use client";

import { useState } from "react";
import type { CallFlow, CallFlowStep } from "@/types";
import { updateCallFlowSteps, toggleCallFlow, deleteCallFlow } from "./actions";
import StepEditor from "./step-editor";

interface CallFlowCardProps {
  flow: CallFlow;
  extensions: { extension: string; display_name: string }[];
}

const defaultSteps: Record<CallFlowStep["type"], CallFlowStep> = {
  ivr: { type: "ivr", greeting: "", options: { "1": "" } },
  ring_group: {
    type: "ring_group",
    strategy: "simultaneous",
    members: [],
    timeout: 30,
  },
  forward: { type: "forward", mode: "always", destination: "" },
};

export default function CallFlowCard({ flow, extensions }: CallFlowCardProps) {
  const [steps, setSteps] = useState<CallFlowStep[]>(flow.steps);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleStepChange(index: number, step: CallFlowStep) {
    const next = [...steps];
    next[index] = step;
    setSteps(next);
    setDirty(true);
  }

  function handleRemoveStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index));
    setDirty(true);
  }

  function handleAddStep(type: CallFlowStep["type"]) {
    setSteps([...steps, { ...defaultSteps[type] }]);
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    await updateCallFlowSteps(flow.id, steps);
    setSaving(false);
    setDirty(false);
  }

  async function handleToggle() {
    setLoading(true);
    await toggleCallFlow(flow.id, !flow.is_active);
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete call flow "${flow.name}"?`)) return;
    setLoading(true);
    await deleteCallFlow(flow.id);
    setLoading(false);
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-navy-900">
      {/* Header */}
      <div
        className="flex cursor-pointer items-center justify-between px-6 py-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-neutral-500">{expanded ? "▼" : "▶"}</span>
          <div>
            <h3 className="font-semibold">{flow.name}</h3>
            {flow.description && (
              <p className="text-sm text-neutral-400">{flow.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-500">
            {steps.length} step{steps.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); handleToggle(); }}
            disabled={loading}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              flow.is_active
                ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                : "bg-neutral-500/10 text-neutral-400 hover:bg-neutral-500/20"
            }`}
          >
            {flow.is_active ? "Active" : "Inactive"}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            disabled={loading}
            className="rounded-lg px-3 py-1 text-xs font-medium text-red-400 transition hover:bg-red-500/10"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Expanded: Step editor */}
      {expanded && (
        <div className="border-t border-neutral-800 px-6 py-5">
          {steps.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No steps yet. Add a step to define how calls are routed.
            </p>
          ) : (
            <div className="space-y-4">
              {steps.map((step, i) => (
                <div key={i}>
                  {i > 0 && (
                    <div className="flex justify-center py-1">
                      <span className="text-xs text-neutral-600">↓</span>
                    </div>
                  )}
                  <StepEditor
                    step={step}
                    index={i}
                    extensions={extensions}
                    onChange={handleStepChange}
                    onRemove={handleRemoveStep}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Add step buttons */}
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="self-center text-xs text-neutral-500">
              Add step:
            </span>
            <button
              onClick={() => handleAddStep("ivr")}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-xyra-500 hover:text-white"
            >
              IVR Menu
            </button>
            <button
              onClick={() => handleAddStep("ring_group")}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-xyra-500 hover:text-white"
            >
              Ring Group
            </button>
            <button
              onClick={() => handleAddStep("forward")}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-xyra-500 hover:text-white"
            >
              Call Forward
            </button>
          </div>

          {/* Save button */}
          {dirty && (
            <div className="mt-5 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-xyra-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-xyra-500/25 transition hover:bg-xyra-600 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
