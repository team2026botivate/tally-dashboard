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
import { ArrowUpDown } from "lucide-react"
import { useCompany } from "@/lib/company-provider"
import { useStockSummary } from "@/lib/hooks/use-dashboard"
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

interface StockRow {
  name: string
  unit: string
  openingQty: string
  closingQty: string
  closingValue: string
  stockGroup: { name: string }
}

export function StockSummary() {
  const { activeCompany } = useCompany()
  const { data = [], isLoading } = useStockSummary(activeCompany?.id)
  const [sorting, setSorting] = useState<SortingState>([])

  const displayData = useMemo(() => data.slice(0, 5), [data])

  const columns = useMemo<ColumnDef<StockRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Item <ArrowUpDown className="size-3" />
          </button>
        ),
      },
      {
        accessorFn: (row) => row.stockGroup?.name ?? "-",
        id: "group",
        header: "Group",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "closingQty",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 font-medium ml-auto"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Closing Qty <ArrowUpDown className="size-3" />
          </button>
        ),
        cell: ({ row }) => {
          const qty = parseFloat(row.original.closingQty)
          return (
            <span className="tabular-nums block text-right">
              {qty.toLocaleString("en-IN")} {row.original.unit}
            </span>
          )
        },
      },
    ],
    []
  )

  const table = useReactTable({
    data: displayData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock Summary</CardTitle>
        <CardDescription>Inventory overview</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : (
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
                    No stock data
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
        )}
      </CardContent>
    </Card>
  )
}
