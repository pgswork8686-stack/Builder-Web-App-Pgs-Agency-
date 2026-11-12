"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { MobileSidebar } from "./mobile-sidebar";
import { Topbar } from "./topbar";
import { ModuleTabs } from "./module-tabs";
import type { AccountPayload, UserPayload } from "@/lib/api/auth";

export interface AppShellProps {
  children: React.ReactNode;
  account: AccountPayload;
  user?: UserPayload | null;
}

export function AppShell({ children, account, user }: AppShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Read initial collapsed state from localStorage if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pgs_sidebar_collapsed");
      if (saved !== null) {
        setSidebarCollapsed(saved === "true");
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("pgs_sidebar_collapsed", String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  return (
    <div className="h-screen bg-[#F8F9FC] text-[#202333] flex flex-row overflow-hidden font-sans">
      {/* Thanh bên V2: 240px, thu gọn 72px */}
      <Sidebar
        account={account}
        user={user}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Mobile Drawer Navigation */}
      <MobileSidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        account={account}
        user={user}
      />

      {/* Main App Content Area - scrolls independently */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          account={account}
          user={user}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-6">
          {/* V2: vùng nội dung rộng cho bảng dữ liệu; tab module tự sinh từ role-navigation */}
          <div className="max-w-[1680px] w-full mx-auto">
            <ModuleTabs role={account.role} />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
