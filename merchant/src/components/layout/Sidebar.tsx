"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  UtensilsCrossed,
  ChefHat,
  Settings,
  LogOut,
  Store,
  LayoutDashboard,
  History,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { getCommerceOrderCopy } from "@/lib/commerceOrderCopy";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, isOwner, restaurants, activeRestaurantId, activeRestaurant, setActiveRestaurant, logout } =
    useAuth();
  const copy = getCommerceOrderCopy(activeRestaurant?.vertical);

  const navigation = [
    { name: "Overview", href: "/", icon: LayoutDashboard, show: isOwner, exact: true },
    { name: "Transactions", href: "/transactions", icon: Wallet, show: isOwner },
    { name: copy.ordersTab, href: "/orders", icon: ClipboardList, show: true, exact: true },
    { name: "Order history", href: "/orders/history", icon: History, show: true },
    { name: copy.menuNav, href: "/menu", icon: UtensilsCrossed, show: true },
    { name: copy.cooksNav, href: "/cooks", icon: ChefHat, show: isOwner },
    { name: "Stores", href: "/stores", icon: Store, show: isOwner },
    { name: "Settings", href: "/settings", icon: Settings, show: isOwner },
  ].filter((n) => n.show);

  const canSwitch = isOwner && restaurants.length > 1;

  return (
    <div className="flex flex-col w-64 h-screen text-white bg-slate-950 border-r border-slate-800">
      <div className="flex items-center gap-2.5 h-16 border-b border-slate-800 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-yellow text-sm font-bold text-foreground">
          Q
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-tight text-white leading-none">QareGO</p>
          <p className="text-[11px] text-brand font-medium mt-0.5">Merchant</p>
        </div>
      </div>

      <div className="px-4 py-4 border-b border-slate-800">
        {canSwitch ? (
          <>
            <label className="text-[11px] uppercase tracking-wide text-slate-500 block mb-1.5 font-medium">
              Active store
            </label>
            <select
              value={activeRestaurantId || ""}
              onChange={(e) => setActiveRestaurant(e.target.value)}
              className="w-full bg-slate-900 text-white text-sm rounded-xl px-3 py-2.5 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {restaurants.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.imageEmoji ? `${r.imageEmoji} ` : ""}
                  {r.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-white truncate">
              {activeRestaurant?.imageEmoji} {activeRestaurant?.name || "No store"}
            </p>
            <p className="text-xs text-slate-500 capitalize mt-0.5">{user?.role}</p>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="px-3 space-y-1">
          {navigation.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-colors",
                  isActive
                    ? "bg-brand/15 text-white ring-1 ring-brand/30"
                    : "text-slate-400 hover:bg-slate-900 hover:text-white"
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 flex-shrink-0 h-5 w-5",
                    isActive ? "text-brand-yellow" : "text-slate-500 group-hover:text-slate-300"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800">
        <button
          type="button"
          onClick={logout}
          className="flex items-center w-full rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:bg-slate-900 hover:text-white transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Sign out
        </button>
      </div>
    </div>
  );
}
