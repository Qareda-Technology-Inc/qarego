"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { KitchenAlerts } from "@/components/KitchenAlerts";
import { AudioAutoEnable } from "@/components/AudioAutoEnable";
import { PushNotificationBootstrap } from "@/components/PushNotificationBootstrap";
import { KitchenAlertEnable } from "@/components/KitchenAlertEnable";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (isLoginPage) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <div
        className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 ease-in-out md:static md:z-auto md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <AudioAutoEnable />
        <PushNotificationBootstrap />
        <KitchenAlertEnable />
        <KitchenAlerts />
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
