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
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />
              <div className="px-4 lg:px-6">
                <ChartAreaInteractive />
              </div>
              <DataTable />
              <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 lg:grid-cols-2">
                <TopLedgers />
                <StockSummary />
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </>
  )
}
