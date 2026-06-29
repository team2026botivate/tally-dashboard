import { useState, useEffect } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import api from "@/lib/api"
import { useCompany } from "@/lib/company"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface VoucherRow {
  voucherNumber: string
  voucherDate: string
  narration: string | null
  totalAmount: string
  voucherType: { name: string }
}

export function DataTable() {
  const [data, setData] = useState<VoucherRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const pageSize = 10

  const { activeCompany } = useCompany()

  useEffect(() => {
    if (!activeCompany) return
    api.get(`/dashboard/recent-vouchers?limit=50&companyId=${activeCompany.id}`)
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [activeCompany])

  const totalPages = Math.ceil(data.length / pageSize)
  const pageData = data.slice(page * pageSize, (page + 1) * pageSize)

  function fmtAmount(amt: string) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(parseFloat(amt) || 0)
  }

  function fmtDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    })
  }

  return (
    <Card className="mx-4 lg:mx-6">
      <CardHeader>
        <CardTitle>Recent Vouchers</CardTitle>
        <CardDescription>Latest voucher entries</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <>
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
                {pageData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No vouchers found
                    </TableCell>
                  </TableRow>
                )}
                {pageData.map((v, i) => (
                  <TableRow key={`${v.voucherNumber}-${i}`}>
                    <TableCell className="font-medium">{v.voucherNumber}</TableCell>
                    <TableCell>{fmtDate(v.voucherDate)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{v.voucherType.name}</Badge>
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-muted-foreground">
                      {v.narration || "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtAmount(v.totalAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeftIcon />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRightIcon />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
