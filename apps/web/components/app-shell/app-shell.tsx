"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { MobileSidebar } from "./mobile-sidebar";
import { Topbar } from "./topbar";
import type { AccountPayload } from "@/lib/api/auth";

export interface AppShellProps {
  children: React.ReactNode;
  account: AccountPayload;
}

export function AppShell({ children, account }: AppShellProps) {
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
    <div className="h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-row overflow-hidden font-sans">
      {/* Desktop Persistent / Collapsible Sidebar - fixed height, never scrolls with content */}
      <Sidebar
        account={account}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Mobile Drawer Navigation */}
      <MobileSidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        account={account}
      />

      {/* Main App Content Area - scrolls independently */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          account={account}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
          <div className="max-w-7xl w-full mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
