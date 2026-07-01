"use client";

import { SidebarProvider } from "@/components/ui/sidebar"
import { CompanyProvider } from "@/lib/company-provider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <CompanyProvider>
      <SidebarProvider>
        {children}
      </SidebarProvider>
    </CompanyProvider>
  );
}
