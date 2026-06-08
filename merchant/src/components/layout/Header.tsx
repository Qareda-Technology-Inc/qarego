"use client";

import { Menu } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, activeRestaurant } = useAuth();
  return (
    <header className="bg-white shadow-sm h-16 flex items-center gap-3 px-4 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="md:hidden -ml-1 p-2 rounded-md text-gray-600 hover:bg-gray-100"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>
      <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
        {activeRestaurant?.imageEmoji} {activeRestaurant?.name || "Select a store"}
      </h2>
      <div className="ml-auto text-sm text-gray-500 hidden sm:block">
        Signed in as <span className="font-medium text-gray-700">{user?.name}</span>
      </div>
    </header>
  );
}
