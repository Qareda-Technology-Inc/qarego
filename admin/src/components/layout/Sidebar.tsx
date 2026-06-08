"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Car, 
  MapPin, 
  Settings, 
  FileText,
  BarChart3,
  UtensilsCrossed,
  Store,
  Tags,
  Radio,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { LogOut } from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Drivers', href: '/drivers', icon: Car },
  { name: 'Dispatch', href: '/dispatch', icon: Radio },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Trips', href: '/trips', icon: MapPin },
  { name: 'Vendors', href: '/vendors', icon: Store },
  { name: 'Store types', href: '/store-types', icon: Tags },
  { name: 'Food orders', href: '/food-orders', icon: UtensilsCrossed },
  { name: 'Finance', href: '/finance', icon: FileText },
  { name: 'Push notifications', href: '/notifications', icon: Bell },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    onNavigate?.();
    logout();
  };

  return (
    <div className="flex flex-col w-64 max-w-[85vw] bg-gray-900 h-screen text-white shadow-xl md:shadow-none">
      <div className="flex items-center justify-center h-16 border-b border-gray-800 px-4">
        <h1 className="text-xl sm:text-2xl font-bold text-blue-500 truncate">
          qareGo<span className="text-white text-sm ml-1">Admin</span>
        </h1>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-gray-800 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 flex-shrink-0 h-6 w-6",
                    isActive ? "text-blue-500" : "text-gray-400 group-hover:text-gray-300"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-4 border-t border-gray-800 space-y-3">
        <div>
          <p className="text-sm font-medium text-white truncate">{user?.name || "Admin"}</p>
          <p className="text-xs text-gray-400 truncate">{user?.role || "admin"}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut className="h-5 w-5 text-gray-400" aria-hidden="true" />
          Log out
        </button>
      </div>
    </div>
  );
}
