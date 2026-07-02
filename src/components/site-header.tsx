"use client";

import { useState } from "react"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCompany } from "@/lib/company-provider"
import { Skeleton } from "@/components/ui/skeleton"
import {
  RefreshCwIcon,
  Building2Icon,
  CheckIcon,
  ChevronDownIcon,
} from "lucide-react"

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/settings": "Settings",
  "/companies": "Companies",
  "/company-data": "Company Data",
  "/tally-configuration": "Tally Configuration",
}

export function SiteHeader() {
  const pathname = usePathname()
  const { companies, activeCompany, loading, switchCompany } = useCompany()
  const [syncing, setSyncing] = useState(false)
  const title = titles[pathname] || "Tally ERP"

  async function handleSync() {
    setSyncing(true)
    try {
      await fetch('/api/tally/sync/full', { method: 'POST' })
      toast.success('Full sync started')
    } catch {
      toast.error('Sync failed')
    }
    setSyncing(false)
  }

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6 min-w-0">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium truncate max-w-[120px] sm:max-w-none">{title}</h1>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleSync} disabled={syncing} title="Sync from Tally">
          <RefreshCwIcon className={`size-4 ${syncing ? "animate-spin" : ""}`} />
        </Button>
        <div className="ml-auto flex items-center gap-2 min-w-0">
          {loading ? (
            <Skeleton className="h-8 w-32 sm:w-40" />
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-32 sm:w-48 justify-between cursor-pointer"
                  >
                    <span className="truncate">
                      {activeCompany?.companyName || "Select company"}
                    </span>
                    <ChevronDownIcon className="size-3 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 max-h-72 overflow-y-auto">
                  {companies.length === 0 ? (
                    <DropdownMenuItem disabled>No companies found</DropdownMenuItem>
                  ) : (
                    companies.map((c) => (
                      <DropdownMenuItem
                        key={c.id}
                        onSelect={() => switchCompany(c.companyName)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Building2Icon className="size-4" />
                        <span className="truncate flex-1">{c.companyName}</span>
                        {activeCompany?.companyName === c.companyName && (
                          <CheckIcon className="size-4 ml-auto text-primary" />
                        )}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              {activeCompany?.lastSyncAt && (
                <span className="text-xs text-muted-foreground hidden lg:inline whitespace-nowrap">
                  Last sync: {new Date(activeCompany.lastSyncAt).toLocaleString("en-IN")}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
