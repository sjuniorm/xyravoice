"use client";

import { Menu } from "lucide-react";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-neutral-800 bg-navy-900/50 px-6 backdrop-blur-sm lg:hidden">
      <button
        onClick={onMenuClick}
        className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/5 hover:text-white"
      >
        <Menu size={20} />
      </button>
      <span className="bg-gradient-to-r from-xyra-300 to-xyra-500 bg-clip-text text-sm font-bold text-transparent">
        Xyra Voice
      </span>
    </header>
  );
}
