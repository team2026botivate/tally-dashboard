"use client";

import { useMemo, useState } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  type ColumnDef,
  flexRender,
} from "@tanstack/react-table"
import { ArrowUpDown, SearchIcon } from "lucide-react"
import { useCompany } from "@/lib/company-provider"
import { useTrialBalance, useRecentVouchers, useStockSummary } from "@/lib/hooks/use-dashboard"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { SidebarInset } from "@/components/ui/sidebar"

interface LedgerRow {
  name: string
  groupName: string
  openingBalance: string
  currentBalance: string
}

interface VoucherRow {
  voucherNumber: string
  voucherDate: string
  narration: string | null
  totalAmount: string
  voucherType: { name: string }
}

interface StockRow {
  name: string
  unit: string
  openingQty: string
  closingQty: string
  closingValue: string
  stockGroup: { name: string }
}

function DataTableCard<T extends Record<string, unknown>>({
  title,
  description,
  data,
  columns,
  isLoading,
  searchPlaceholder,
  globalFilter,
  onGlobalFilterChange,
}: {
  title: string
  description: string
  data: T[]
  columns: ColumnDef<T>[]
  isLoading: boolean
  searchPlaceholder?: string
  globalFilter?: string
  onGlobalFilterChange?: (val: string) => void
}) {
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <Card className="mx-4 lg:mx-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {searchPlaceholder && onGlobalFilterChange && (
            <div className="relative w-48">
              <SearchIcon className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter}
                onChange={(e) => onGlobalFilterChange(e.target.value)}
                className="pl-8 h-8"
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                      No data
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {data.length > 0 && (
              <p className="text-sm text-muted-foreground mt-2">{data.length} records</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function CompanyDataPage() {
  const { activeCompany } = useCompany()
  const { data: ledgers = [], isLoading: loadingLedgers } = useTrialBalance(activeCompany?.id)
  const { data: vouchers = [], isLoading: loadingVouchers } = useRecentVouchers(activeCompany?.id, 20)
  const { data: stockItems = [], isLoading: loadingStock } = useStockSummary(activeCompany?.id)

  const [ledgerSearch, setLedgerSearch] = useState("")
  const [voucherSearch, setVoucherSearch] = useState("")
  const [stockSearch, setStockSearch] = useState("")

  const isLoading = loadingLedgers || loadingVouchers || loadingStock

  const ledgerColumns = useMemo<ColumnDef<LedgerRow>[]>(
    () => [
      { accessorKey: "name", header: ({ column }) => (
        <button className="flex items-center gap-1 font-medium" onClick={() => column.toggleSorting()}>
          Name <ArrowUpDown className="size-3" />
        </button>
      )},
      { accessorKey: "groupName", header: "Group",
        cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as string}</span> },
      { accessorKey: "openingBalance", header: ({ column }) => (
        <button className="flex items-center gap-1 font-medium ml-auto" onClick={() => column.toggleSorting()}>
          Opening Balance <ArrowUpDown className="size-3" />
        </button>
      ), cell: ({ getValue }) => {
        const v = parseFloat(getValue() as string) || 0
        return <span className="tabular-nums block text-right">{v.toLocaleString("en-IN")}</span>
      }},
      { accessorKey: "currentBalance", header: ({ column }) => (
        <button className="flex items-center gap-1 font-medium ml-auto" onClick={() => column.toggleSorting()}>
          Current Balance <ArrowUpDown className="size-3" />
        </button>
      ), cell: ({ getValue }) => {
        const v = parseFloat(getValue() as string) || 0
        return <span className="tabular-nums block text-right">{v.toLocaleString("en-IN")}</span>
      }},
    ], []
  )

  const voucherColumns = useMemo<ColumnDef<VoucherRow>[]>(
    () => [
      { accessorKey: "voucherNumber", header: ({ column }) => (
        <button className="flex items-center gap-1 font-medium" onClick={() => column.toggleSorting()}>
          Voucher # <ArrowUpDown className="size-3" />
        </button>
      )},
      { accessorKey: "voucherDate", header: ({ column }) => (
        <button className="flex items-center gap-1 font-medium" onClick={() => column.toggleSorting()}>
          Date <ArrowUpDown className="size-3" />
        </button>
      ), cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString("en-IN") },
      { accessorFn: (r) => r.voucherType?.name ?? "-", id: "type", header: "Type",
        cell: ({ getValue }) => <Badge variant="outline">{getValue() as string}</Badge> },
      { accessorKey: "narration", header: "Narration",
        cell: ({ getValue }) => {
          const v = getValue() as string | null
          return <span className="max-w-48 truncate text-muted-foreground block">{v || "-"}</span>
        }},
      { accessorKey: "totalAmount", header: ({ column }) => (
        <button className="flex items-center gap-1 font-medium ml-auto" onClick={() => column.toggleSorting()}>
          Amount <ArrowUpDown className="size-3" />
        </button>
      ), cell: ({ getValue }) => {
        const v = parseFloat(getValue() as string) || 0
        return <span className="tabular-nums block text-right">{v.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 })}</span>
      }},
    ], []
  )

  const stockColumns = useMemo<ColumnDef<StockRow>[]>(
    () => [
      { accessorKey: "name", header: ({ column }) => (
        <button className="flex items-center gap-1 font-medium" onClick={() => column.toggleSorting()}>
          Item <ArrowUpDown className="size-3" />
        </button>
      )},
      { accessorFn: (r) => r.stockGroup?.name ?? "-", id: "group", header: "Group",
        cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as string}</span> },
      { accessorKey: "unit", header: "Unit",
        cell: ({ getValue }) => (getValue() as string) || "-" },
      { accessorKey: "openingQty", header: ({ column }) => (
        <button className="flex items-center gap-1 font-medium ml-auto" onClick={() => column.toggleSorting()}>
          Opening Qty <ArrowUpDown className="size-3" />
        </button>
      ), cell: ({ getValue }) => {
        const v = parseFloat(getValue() as string) || 0
        return <span className="tabular-nums block text-right">{v.toLocaleString("en-IN")}</span>
      }},
      { accessorKey: "closingQty", header: ({ column }) => (
        <button className="flex items-center gap-1 font-medium ml-auto" onClick={() => column.toggleSorting()}>
          Closing Qty <ArrowUpDown className="size-3" />
        </button>
      ), cell: ({ getValue }) => {
        const v = parseFloat(getValue() as string) || 0
        return <span className="tabular-nums block text-right">{v.toLocaleString("en-IN")}</span>
      }},
    ], []
  )

  const filteredLedgers = useMemo(
    () => ledgers.slice(0, 50).filter((l) => !ledgerSearch || l.name.toLowerCase().includes(ledgerSearch.toLowerCase())),
    [ledgers, ledgerSearch]
  )
  const filteredVouchers = useMemo(
    () => vouchers.filter((v) => !voucherSearch || v.voucherNumber?.toLowerCase().includes(voucherSearch.toLowerCase())),
    [vouchers, voucherSearch]
  )
  const filteredStock = useMemo(
    () => stockItems.slice(0, 50).filter((s) => !stockSearch || s.name.toLowerCase().includes(stockSearch.toLowerCase())),
    [stockItems, stockSearch]
  )

  if (!activeCompany) {
    return (
      <>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col gap-4 pt-4 px-4 lg:px-6">
            <p className="text-muted-foreground">No company selected. Please configure and activate a company first.</p>
          </div>
        </SidebarInset>
      </>
    )
  }

  return (
    <>
      <AppSidebar variant="inset" />
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

          {isLoading ? (
            <div className="space-y-4 px-4 lg:px-6">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <>
              <div className="hidden lg:block space-y-4">
                <DataTableCard
                  title={`Ledgers (${ledgers.length})`}
                  description="All ledger accounts"
                  data={filteredLedgers as any}
                  columns={ledgerColumns as any}
                  isLoading={false}
                  searchPlaceholder="Search ledgers..."
                  globalFilter={ledgerSearch}
                  onGlobalFilterChange={setLedgerSearch}
                />
                <DataTableCard
                  title={`Recent Vouchers (${vouchers.length})`}
                  description="Latest transactions"
                  data={filteredVouchers as any}
                  columns={voucherColumns as any}
                  isLoading={false}
                  searchPlaceholder="Search vouchers..."
                  globalFilter={voucherSearch}
                  onGlobalFilterChange={setVoucherSearch}
                />
                <DataTableCard
                  title={`Stock Items (${stockItems.length})`}
                  description="Inventory items"
                  data={filteredStock as any}
                  columns={stockColumns as any}
                  isLoading={false}
                  searchPlaceholder="Search items..."
                  globalFilter={stockSearch}
                  onGlobalFilterChange={setStockSearch}
                />
              </div>
              <div className="lg:hidden px-4 lg:px-6">
                <Accordion type="single" collapsible className="space-y-4">
                  <AccordionItem value="ledgers" className="border rounded-lg px-4">
                    <AccordionTrigger className="text-lg font-semibold">
                      Ledgers ({ledgers.length})
                    </AccordionTrigger>
                    <AccordionContent>
                      <Input
                        placeholder="Search ledgers..."
                        value={ledgerSearch}
                        onChange={(e) => setLedgerSearch(e.target.value)}
                        className="mb-2 h-8"
                      />
                      <div className="max-h-64 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead className="text-right">Balance</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredLedgers.map((l) => (
                              <TableRow key={l.name}>
                                <TableCell className="font-medium">{l.name}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {parseFloat(l.currentBalance).toLocaleString("en-IN")}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="vouchers" className="border rounded-lg px-4">
                    <AccordionTrigger className="text-lg font-semibold">
                      Recent Vouchers ({vouchers.length})
                    </AccordionTrigger>
                    <AccordionContent>
                      <Input
                        placeholder="Search vouchers..."
                        value={voucherSearch}
                        onChange={(e) => setVoucherSearch(e.target.value)}
                        className="mb-2 h-8"
                      />
                      <div className="max-h-64 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Voucher #</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredVouchers.map((v, i) => (
                              <TableRow key={`${v.voucherNumber}-${i}`}>
                                <TableCell className="font-medium">{v.voucherNumber}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {parseFloat(v.totalAmount).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 })}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="stock" className="border rounded-lg px-4">
                    <AccordionTrigger className="text-lg font-semibold">
                      Stock Items ({stockItems.length})
                    </AccordionTrigger>
                    <AccordionContent>
                      <Input
                        placeholder="Search items..."
                        value={stockSearch}
                        onChange={(e) => setStockSearch(e.target.value)}
                        className="mb-2 h-8"
                      />
                      <div className="max-h-64 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Item</TableHead>
                              <TableHead className="text-right">Closing Qty</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredStock.map((s) => (
                              <TableRow key={s.name}>
                                <TableCell className="font-medium">{s.name}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {parseFloat(s.closingQty).toLocaleString("en-IN")}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </>
          )}
        </div>
      </SidebarInset>
    </>
  )
}
