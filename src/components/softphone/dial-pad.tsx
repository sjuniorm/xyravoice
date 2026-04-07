"use client";

import { useRef } from "react";

const keys = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

interface DialPadProps {
  onPress: (key: string) => void;
  onLongPress?: (key: string) => void;
}

export default function DialPad({ onPress, onLongPress }: DialPadProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFiredRef = useRef(false);

  function startPress(key: string) {
    longFiredRef.current = false;
    if (onLongPress) {
      timerRef.current = setTimeout(() => {
        longFiredRef.current = true;
        onLongPress(key);
      }, 500);
    }
  }

  function endPress(key: string) {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!longFiredRef.current) {
      onPress(key);
    }
  }

  function cancelPress() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    longFiredRef.current = false;
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.flat().map((key) => (
        <button
          key={key}
          onMouseDown={() => startPress(key)}
          onMouseUp={() => endPress(key)}
          onMouseLeave={cancelPress}
          onTouchStart={() => startPress(key)}
          onTouchEnd={() => endPress(key)}
          onTouchCancel={cancelPress}
          className="flex h-12 flex-col items-center justify-center rounded-xl bg-navy-800 text-lg font-semibold text-white transition hover:bg-neutral-700 active:scale-95"
        >
          <span>{key}</span>
          {key === "0" && (
            <span className="text-[9px] font-normal text-neutral-500">
              hold for +
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
