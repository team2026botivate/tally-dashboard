import { useCompany } from "@/lib/company"
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
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Building2Icon, ClockIcon, CheckCircle2Icon } from "lucide-react"

export function CompaniesPage() {
  const { companies, activeCompany, loading, switchCompany } = useCompany()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 pt-4">
          <div className="px-4 lg:px-6">
            <h1 className="text-2xl font-semibold">Companies</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Companies detected on your Tally instance
            </p>
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
            ) : companies.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-full">
                No companies found. Check your Tally configuration in Settings.
              </p>
            ) : (
              companies.map((company) => {
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
                        {activeCompany?.companyName === company.companyName && activeCompany?.lastSyncAt
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
    </SidebarProvider>
  )
}
