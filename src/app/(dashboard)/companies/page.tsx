"use client";

import { useState } from "react"
import { SearchIcon } from "lucide-react"
import { useCompany } from "@/lib/company-provider"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset } from "@/components/ui/sidebar"
import { Building2Icon, ClockIcon, CheckCircle2Icon } from "lucide-react"

export default function CompaniesPage() {
  const { companies, activeCompany, loading, switchCompany } = useCompany()
  const [search, setSearch] = useState("")

  const filtered = companies.filter((c) =>
    c.companyName.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 pt-4">
          <div className="flex items-center justify-between px-4 lg:px-6">
            <div>
              <h1 className="text-2xl font-semibold">Companies</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Companies detected on your Tally instance
              </p>
            </div>
            <div className="relative w-48">
              <SearchIcon className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 sm:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-20" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-9 w-24" />
                  </CardContent>
                </Card>
              ))
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-full">
                {companies.length === 0
                  ? "No companies found. Check your Tally configuration in Settings."
                  : "No companies match your search."}
              </p>
            ) : (
              filtered.map((company) => {
                const isActive = activeCompany?.companyName === company.companyName
                return (
                  <Card key={company.id} className={isActive ? "ring-2 ring-primary" : ""}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Building2Icon className="size-4 text-muted-foreground" />
                          {company.companyName}
                        </CardTitle>
                        {isActive && (
                          <Badge variant="default" className="flex items-center gap-1">
                            <CheckCircle2Icon className="size-3" />
                            Active
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="flex items-center gap-1">
                        <ClockIcon className="size-3" />
                        {isActive && activeCompany?.lastSyncAt
                          ? "Last sync: " + new Date(activeCompany.lastSyncAt).toLocaleString("en-IN")
                          : "Not synced yet"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {!isActive && (
                        <Button
                          size="sm"
                          onClick={() => switchCompany(company.companyName)}
                        >
                          Set Active
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
