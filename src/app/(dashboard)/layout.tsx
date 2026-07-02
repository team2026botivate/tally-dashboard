"use client";

import { SidebarProvider } from "@/components/ui/sidebar"
import { CompanyProvider } from "@/lib/company-provider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <CompanyProvider>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        {children}
      </SidebarProvider>
    </CompanyProvider>
  );
}
