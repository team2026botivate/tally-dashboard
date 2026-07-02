"use client";

import { useState, useCallback } from "react"
import {
  SearchIcon,
  Building2Icon,
  ClockIcon,
  CheckCircle2Icon,
  RefreshCwIcon,
  RadioIcon,
  ServerIcon,
  GlobeIcon,
  ActivityIcon,
  AlertTriangleIcon
} from "lucide-react"
import { useCompany } from "@/lib/company-provider"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset } from "@/components/ui/sidebar"
import { toast } from "sonner"

interface FullCompany {
  id: string
  companyName: string
  host: string
  port: number
  isActive: boolean
  isRemote: boolean
  status: string
  lastSyncAt: string | null
  createdAt: string
}

export default function CompaniesPage() {
  const { activeCompany, loading, switchCompany, refreshCompanies } = useCompany()
  const [search, setSearch] = useState("")
  const [allCompanies, setAllCompanies] = useState<FullCompany[]>([])
  const [fetched, setFetched] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadCompanies = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch("/api/config/all")
      if (res.ok) {
        const data = await res.json()
        setAllCompanies(Array.isArray(data) ? data : [])
      }
    } catch {
      toast.error("Failed to load companies")
    } finally {
      setRefreshing(false)
      setFetched(true)
    }
  }, [])

  // Load on first render
  if (!fetched && !refreshing) {
    loadCompanies()
  }

  const filtered = allCompanies.filter((c) =>
    c.companyName.toLowerCase().includes(search.toLowerCase())
  )

  const handleSwitch = async (company: FullCompany) => {
    setSwitching(company.id)
    try {
      await switchCompany(company.companyName)
      await loadCompanies()
      refreshCompanies()
    } finally {
      setSwitching(null)
    }
  }

  const handleRefresh = async () => {
    await loadCompanies()
    refreshCompanies()
  }

  const formatSync = (date: string | null) => {
    if (!date) return "Never synced"
    const d = new Date(date)
    const diff = Date.now() - d.getTime()
    if (diff < 60000) return "Just now"
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
  }

  return (
    <>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-6 pt-4">
          {/* Header */}
          <div className="flex items-center justify-between px-4 lg:px-6">
            <div>
              <h1 className="text-2xl font-semibold">Companies</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {allCompanies.length} compan{allCompanies.length !== 1 ? "ies" : "y"} synced from Tally
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-52">
                <SearchIcon className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search companies..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="gap-1.5"
              >
                <RefreshCwIcon className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Active company banner */}
          {activeCompany && (
            <div className="mx-4 lg:mx-6 rounded-lg border bg-primary/5 border-primary/20 px-4 py-3 flex items-center gap-3">
              <CheckCircle2Icon className="size-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  Currently viewing: <span className="text-primary">{activeCompany.companyName}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {activeCompany.host}:{activeCompany.port} · Last sync: {formatSync(activeCompany.lastSyncAt)}
                </p>
              </div>
            </div>
          )}

          {/* Company cards grid */}
          <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 sm:grid-cols-2 lg:grid-cols-3">
            {loading && !fetched ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-28 mt-1" />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-9 w-28" />
                  </CardContent>
                </Card>
              ))
            ) : filtered.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Building2Icon className="size-12 text-muted-foreground/30" />
                <div>
                  <p className="font-medium text-muted-foreground">
                    {allCompanies.length === 0 ? "No companies synced yet" : "No companies match your search"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {allCompanies.length === 0
                      ? "Run the Tally Agent on your PC to start syncing company data."
                      : "Try a different search term."}
                  </p>
                </div>
              </div>
            ) : (
              filtered.map((company) => {
                const isActive = activeCompany?.id === company.id
                const isSwitching = switching === company.id
                const isOnline = company.status === "ONLINE"

                return (
                  <Card
                    key={company.id}
                    className={`transition-all duration-200 ${isActive ? "ring-2 ring-primary shadow-md" : "hover:shadow-sm"}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base flex items-center gap-2 leading-tight">
                          <Building2Icon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{company.companyName}</span>
                        </CardTitle>
                        <div className="flex items-center gap-1 shrink-0">
                          {isActive && (
                            <Badge variant="default" className="text-xs gap-1 shrink-0">
                              <CheckCircle2Icon className="size-3" />
                              Active
                            </Badge>
                          )}
                          {company.isRemote ? (
                            <Badge variant="outline" className="text-xs gap-1 shrink-0">
                              <GlobeIcon className="size-3" />
                              Agent
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs gap-1 shrink-0">
                              <ServerIcon className="size-3" />
                              Local
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardDescription className="flex items-center gap-1 text-xs mt-1">
                        <span className="font-mono">{company.host}:{company.port}</span>
                        <span className="mx-1">·</span>
                        {isOnline ? (
                          <span className="text-green-600 flex items-center gap-1">
                            <ActivityIcon className="size-3" /> Online
                          </span>
                        ) : (
                          <span className="text-muted-foreground flex items-center gap-1">
                            <AlertTriangleIcon className="size-3" /> Offline
                          </span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                        <ClockIcon className="size-3" />
                        <span>{formatSync(company.lastSyncAt)}</span>
                      </div>
                      {isActive ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                            <CheckCircle2Icon className="size-4" />
                            Currently Active
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="default"
                          className="w-full"
                          disabled={isSwitching}
                          onClick={() => handleSwitch(company)}
                        >
                          {isSwitching ? (
                            <>
                              <RefreshCwIcon className="size-3 mr-1.5 animate-spin" />
                              Switching...
                            </>
                          ) : (
                            "Set as Active"
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </div>
      </SidebarInset>
    </>
  )
}
