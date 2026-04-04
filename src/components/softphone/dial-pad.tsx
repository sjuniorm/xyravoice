"use client";

const keys = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

interface DialPadProps {
  onPress: (key: string) => void;
}

export default function DialPad({ onPress }: DialPadProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.flat().map((key) => (
        <button
          key={key}
          onClick={() => onPress(key)}
          className="flex h-12 items-center justify-center rounded-xl bg-navy-800 text-lg font-semibold text-white transition hover:bg-neutral-700 active:scale-95"
        >
          {key}
        </button>
      ))}
    </div>
  );
}
