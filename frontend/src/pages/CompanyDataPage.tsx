import { useState, useEffect } from "react"
import api from "@/lib/api"
import { useCompany } from "@/lib/company"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export function CompanyDataPage() {
  const { activeCompany } = useCompany()
  const [ledgers, setLedgers] = useState<any[]>([])
  const [vouchers, setVouchers] = useState<any[]>([])
  const [stockItems, setStockItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activeCompany) {
      setLoading(false)
      return
    }
    Promise.all([
      api.get("/dashboard/trial-balance"),
      api.get("/dashboard/recent-vouchers?limit=20"),
      api.get("/dashboard/stock-summary"),
    ])
      .then(([tb, rv, ss]) => {
        setLedgers(tb.data)
        setVouchers(rv.data)
        setStockItems(ss.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [activeCompany])

  if (!activeCompany) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col gap-4 pt-4 px-4 lg:px-6">
            <p className="text-muted-foreground">No company selected. Please configure and activate a company first.</p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 pt-4">
          <div className="px-4 lg:px-6">
            <h2 className="text-lg font-semibold mb-1">{activeCompany.companyName}</h2>
            <p className="text-sm text-muted-foreground">
              {activeCompany.host}:{activeCompany.port}
              {activeCompany.lastSyncAt && ` — Last sync: ${new Date(activeCompany.lastSyncAt).toLocaleString("en-IN")}`}
            </p>
          </div>

          {loading ? (
            <div className="space-y-4 px-4 lg:px-6">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <>
              <Card className="mx-4 lg:mx-6">
                <CardHeader>
                  <CardTitle>Ledgers ({ledgers.length})</CardTitle>
                  <CardDescription>All ledger accounts</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Group</TableHead>
                        <TableHead className="text-right">Opening Balance</TableHead>
                        <TableHead className="text-right">Current Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledgers.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No data</TableCell></TableRow>
                      ) : (
                        ledgers.slice(0, 50).map((l: any) => (
                          <TableRow key={l.name}>
                            <TableCell className="font-medium">{l.name}</TableCell>
                            <TableCell className="text-muted-foreground">{l.groupName}</TableCell>
                            <TableCell className="text-right tabular-nums">{parseFloat(l.openingBalance).toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-right tabular-nums">{parseFloat(l.currentBalance).toLocaleString("en-IN")}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="mx-4 lg:mx-6">
                <CardHeader>
                  <CardTitle>Recent Vouchers ({vouchers.length})</CardTitle>
                  <CardDescription>Latest transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Voucher #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Narration</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vouchers.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No data</TableCell></TableRow>
                      ) : (
                        vouchers.map((v: any, i: number) => (
                          <TableRow key={`${v.voucherNumber}-${i}`}>
                            <TableCell className="font-medium">{v.voucherNumber}</TableCell>
                            <TableCell>{new Date(v.voucherDate).toLocaleDateString("en-IN")}</TableCell>
                            <TableCell><Badge variant="outline">{v.voucherType?.name || "-"}</Badge></TableCell>
                            <TableCell className="max-w-48 truncate text-muted-foreground">{v.narration || "-"}</TableCell>
                            <TableCell className="text-right tabular-nums">{parseFloat(v.totalAmount).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 })}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="mx-4 lg:mx-6">
                <CardHeader>
                  <CardTitle>Stock Items ({stockItems.length})</CardTitle>
                  <CardDescription>Inventory items</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Group</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="text-right">Opening Qty</TableHead>
                        <TableHead className="text-right">Closing Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockItems.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No data</TableCell></TableRow>
                      ) : (
                        stockItems.slice(0, 50).map((s: any) => (
                          <TableRow key={s.name}>
                            <TableCell className="font-medium">{s.name}</TableCell>
                            <TableCell className="text-muted-foreground">{s.stockGroup?.name || "-"}</TableCell>
                            <TableCell>{s.unit || "-"}</TableCell>
                            <TableCell className="text-right tabular-nums">{parseFloat(s.openingQty).toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-right tabular-nums">{parseFloat(s.closingQty).toLocaleString("en-IN")}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
