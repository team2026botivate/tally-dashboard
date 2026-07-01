"use client";

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SectionCards } from "@/components/section-cards"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { TopLedgers } from "@/components/top-ledgers"
import { StockSummary } from "@/components/stock-summary"
import { SidebarInset } from "@/components/ui/sidebar"

export default function DashboardPage() {
  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 pt-4">
          <SectionCards />
          <div className="px-4 lg:px-6">
            <ChartAreaInteractive />
          </div>
          <DataTable />
          <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @4xl:grid-cols-2">
            <TopLedgers />
            <StockSummary />
          </div>
        </div>
      </SidebarInset>
    </>
  )
}
