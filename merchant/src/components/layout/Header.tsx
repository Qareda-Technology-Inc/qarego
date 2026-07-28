"use client";

import { Menu } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, activeRestaurant } = useAuth();
  return (
    <header className="bg-white/90 backdrop-blur border-b border-border h-16 flex items-center gap-3 px-4 sm:px-6 shrink-0">
      <button
        type="button"
        onClick={onMenuClick}
        className="md:hidden -ml-1 p-2 rounded-xl text-slate-600 hover:bg-slate-100"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>
      <div className="min-w-0">
        <h2 className="text-base sm:text-lg font-semibold text-foreground truncate">
          {activeRestaurant?.imageEmoji} {activeRestaurant?.name || "Select a store"}
        </h2>
      </div>
      <div className="ml-auto hidden sm:flex items-center gap-2 text-sm text-muted">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-brand text-xs font-bold">
          {(user?.name || "M").charAt(0).toUpperCase()}
        </span>
        <span className="font-medium text-foreground">{user?.name}</span>
      </div>
    </header>
  );
}
