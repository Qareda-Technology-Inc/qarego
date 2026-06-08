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
    { name: copy.ordersTab, href: "/orders", icon: ClipboardList, show: true, exact: true },
    { name: "Order history", href: "/orders/history", icon: History, show: true },
    { name: copy.menuNav, href: "/menu", icon: UtensilsCrossed, show: true },
    { name: copy.cooksNav, href: "/cooks", icon: ChefHat, show: isOwner },
    { name: "Stores", href: "/stores", icon: Store, show: isOwner },
    { name: "Settings", href: "/settings", icon: Settings, show: isOwner },
  ].filter((n) => n.show);

  const canSwitch = isOwner && restaurants.length > 1;

  return (
    <div className="flex flex-col w-64 bg-gray-900 h-screen text-white">
      <div className="flex items-center justify-center h-16 border-b border-gray-800 px-4">
        <h1 className="text-xl font-bold text-orange-500">
          QareGO<span className="text-white text-sm ml-1">Merchant</span>
        </h1>
      </div>

      <div className="px-4 py-4 border-b border-gray-800">
        {canSwitch ? (
          <>
            <label className="text-xs text-gray-400 block mb-1">Active store</label>
            <select
              value={activeRestaurantId || ""}
              onChange={(e) => setActiveRestaurant(e.target.value)}
              className="w-full bg-gray-800 text-white text-sm rounded-md px-2 py-2 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-500"
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
            <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="px-2 space-y-1">
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
                  "group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 flex-shrink-0 h-6 w-6",
                    isActive ? "text-orange-500" : "text-gray-400 group-hover:text-gray-300"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-gray-800">
        <button
          type="button"
          onClick={logout}
          className="flex items-center w-full text-sm text-gray-300 hover:text-white"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Sign out
        </button>
      </div>
    </div>
  );
}
