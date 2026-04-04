"use client";

import type { CallFlowStep, IvrStep, RingGroupStep, ForwardStep } from "@/types";

interface StepEditorProps {
  step: CallFlowStep;
  index: number;
  extensions: { extension: string; display_name: string }[];
  onChange: (index: number, step: CallFlowStep) => void;
  onRemove: (index: number) => void;
}

const stepLabels: Record<CallFlowStep["type"], string> = {
  ivr: "IVR Menu",
  ring_group: "Ring Group",
  forward: "Call Forward",
};

export default function StepEditor({
  step,
  index,
  extensions,
  onChange,
  onRemove,
}: StepEditorProps) {
  return (
    <div className="rounded-lg border border-neutral-700 bg-navy-950 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-xyra-400">
          Step {index + 1} — {stepLabels[step.type]}
        </span>
        <button
          onClick={() => onRemove(index)}
          className="text-xs text-red-400 hover:text-red-300"
        >
          Remove
        </button>
      </div>

      <div className="mt-3">
        {step.type === "ivr" && (
          <IvrEditor
            step={step}
            extensions={extensions}
            onChange={(s) => onChange(index, s)}
          />
        )}
        {step.type === "ring_group" && (
          <RingGroupEditor
            step={step}
            extensions={extensions}
            onChange={(s) => onChange(index, s)}
          />
        )}
        {step.type === "forward" && (
          <ForwardEditor
            step={step}
            onChange={(s) => onChange(index, s)}
          />
        )}
      </div>
    </div>
  );
}

// ─── IVR Editor ───
function IvrEditor({
  step,
  extensions,
  onChange,
}: {
  step: IvrStep;
  extensions: { extension: string; display_name: string }[];
  onChange: (step: IvrStep) => void;
}) {
  function setGreeting(greeting: string) {
    onChange({ ...step, greeting });
  }

  function setOption(key: string, value: string) {
    onChange({ ...step, options: { ...step.options, [key]: value } });
  }

  function removeOption(key: string) {
    const opts = { ...step.options };
    delete opts[key];
    onChange({ ...step, options: opts });
  }

  function addOption() {
    const nextKey = String(Object.keys(step.options).length + 1);
    onChange({ ...step, options: { ...step.options, [nextKey]: "" } });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-neutral-400">
          Greeting Message
        </label>
        <input
          type="text"
          value={step.greeting}
          onChange={(e) => setGreeting(e.target.value)}
          placeholder="Welcome to Acme Corp. Press 1 for sales..."
          className="mt-1 block w-full rounded-lg border border-neutral-700 bg-navy-900 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-xyra-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-400">
          Menu Options
        </label>
        <div className="mt-1 space-y-2">
          {Object.entries(step.options).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-8 text-center text-sm font-mono text-xyra-400">
                {key}
              </span>
              <select
                value={value}
                onChange={(e) => setOption(key, e.target.value)}
                className="flex-1 rounded-lg border border-neutral-700 bg-navy-900 px-3 py-1.5 text-sm text-white focus:border-xyra-500 focus:outline-none"
              >
                <option value="">Select destination...</option>
                {extensions.map((ext) => (
                  <option key={ext.extension} value={`ext:${ext.extension}`}>
                    Ext {ext.extension} — {ext.display_name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => removeOption(key)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addOption}
          className="mt-2 text-xs text-xyra-400 hover:text-xyra-300"
        >
          + Add option
        </button>
      </div>
    </div>
  );
}

// ─── Ring Group Editor ───
function RingGroupEditor({
  step,
  extensions,
  onChange,
}: {
  step: RingGroupStep;
  extensions: { extension: string; display_name: string }[];
  onChange: (step: RingGroupStep) => void;
}) {
  function toggleMember(ext: string) {
    const members = step.members.includes(ext)
      ? step.members.filter((m) => m !== ext)
      : [...step.members, ext];
    onChange({ ...step, members });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-neutral-400">
            Ring Strategy
          </label>
          <select
            value={step.strategy}
            onChange={(e) =>
              onChange({
                ...step,
                strategy: e.target.value as "simultaneous" | "sequential",
              })
            }
            className="mt-1 block w-full rounded-lg border border-neutral-700 bg-navy-900 px-3 py-2 text-sm text-white focus:border-xyra-500 focus:outline-none"
          >
            <option value="simultaneous">Simultaneous (ring all)</option>
            <option value="sequential">Sequential (one by one)</option>
          </select>
        </div>
        <div className="w-24">
          <label className="block text-xs font-medium text-neutral-400">
            Timeout (s)
          </label>
          <input
            type="number"
            min={5}
            max={120}
            value={step.timeout}
            onChange={(e) =>
              onChange({ ...step, timeout: parseInt(e.target.value) || 30 })
            }
            className="mt-1 block w-full rounded-lg border border-neutral-700 bg-navy-900 px-3 py-2 text-sm text-white focus:border-xyra-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-400">
          Members
        </label>
        {extensions.length === 0 ? (
          <p className="mt-1 text-xs text-neutral-500">
            No extensions created yet. Add extensions first.
          </p>
        ) : (
          <div className="mt-1 flex flex-wrap gap-2">
            {extensions.map((ext) => {
              const selected = step.members.includes(ext.extension);
              return (
                <button
                  key={ext.extension}
                  type="button"
                  onClick={() => toggleMember(ext.extension)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    selected
                      ? "bg-xyra-500/20 text-xyra-400 ring-1 ring-xyra-500"
                      : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                  }`}
                >
                  {ext.extension} — {ext.display_name}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Forward Editor ───
function ForwardEditor({
  step,
  onChange,
}: {
  step: ForwardStep;
  onChange: (step: ForwardStep) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-neutral-400">
          Forward Mode
        </label>
        <select
          value={step.mode}
          onChange={(e) =>
            onChange({
              ...step,
              mode: e.target.value as "always" | "busy" | "no_answer",
            })
          }
          className="mt-1 block w-full rounded-lg border border-neutral-700 bg-navy-900 px-3 py-2 text-sm text-white focus:border-xyra-500 focus:outline-none"
        >
          <option value="always">Always</option>
          <option value="busy">When Busy</option>
          <option value="no_answer">No Answer</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-400">
          Destination (extension or phone number)
        </label>
        <input
          type="text"
          value={step.destination}
          onChange={(e) => onChange({ ...step, destination: e.target.value })}
          placeholder="101 or +34600123456"
          className="mt-1 block w-full rounded-lg border border-neutral-700 bg-navy-900 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-xyra-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
