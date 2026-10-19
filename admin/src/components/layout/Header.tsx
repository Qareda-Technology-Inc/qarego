"use client";

import { Menu, LogOut } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, logout } = useAuth();
  const apiBase = typeof window !== "undefined" ? getApiBaseUrl() : "";

  return (
    <header className="bg-white shadow-sm h-16 flex items-center gap-2 sm:gap-3 px-4 sm:px-6 shrink-0">
      <button
        type="button"
        onClick={onMenuClick}
        className="md:hidden -ml-1 p-2 rounded-md text-gray-600 hover:bg-gray-100"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      <div className="flex-1 flex items-center gap-2 sm:gap-4 min-w-0">
        {process.env.NODE_ENV === "development" && apiBase && (
          <p className="hidden lg:block text-xs text-gray-400 font-mono truncate max-w-[200px]">
            API: {apiBase}
          </p>
        )}

        <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
          {user?.name ? (
            <span className="hidden sm:inline text-sm font-medium text-gray-700 truncate max-w-[140px]">
              {user.name}
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={logout}
            className="gap-1.5"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Log out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
