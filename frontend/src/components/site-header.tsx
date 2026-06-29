import { useState } from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCompany } from "@/lib/company"
import api from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { RefreshCwIcon } from "lucide-react"

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/settings": "Settings",
  "/sync": "Sync Management",
  "/companies": "Companies",
  "/company-data": "Company Data",
}

export function SiteHeader() {
  const location = useLocation()
  const { companies, activeCompany, loading, switchCompany } = useCompany()
  const [syncing, setSyncing] = useState(false)
  const title = titles[location.pathname] || "Tally ERP"

  async function handleSync() {
    setSyncing(true)
    try {
      await api.post('/tally/sync/full')
      toast.success('Full sync started')
    } catch {
      toast.error('Sync failed')
    }
    setSyncing(false)
  }

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title}</h1>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSync} disabled={syncing} title="Sync from Tally">
          <RefreshCwIcon className={`size-4 ${syncing ? "animate-spin" : ""}`} />
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {loading ? (
            <Skeleton className="h-8 w-40" />
          ) : (
            <div className="flex items-center gap-2">
              <Select
                value={activeCompany?.companyName || ""}
                onValueChange={(val) => switchCompany(val)}
              >
                <SelectTrigger className="h-8 w-48">
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.length === 0 ? (
                    <SelectItem value="_none" disabled>No companies found</SelectItem>
                  ) : (
                    <SelectGroup>
                      <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                        Companies
                      </SelectLabel>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.companyName}>
                          {c.companyName}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
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
