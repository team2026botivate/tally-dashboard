import { useState, useEffect } from "react"
import api from "@/lib/api"
import { useCompany } from "@/lib/company"
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
  const [data, setData] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)

  const { activeCompany } = useCompany()

  useEffect(() => {
    if (!activeCompany) return
    api.get(`/dashboard/stock-summary?companyId=${activeCompany.id}`)
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [activeCompany])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock Summary</CardTitle>
        <CardDescription>Inventory overview</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Group</TableHead>
                <TableHead className="text-right">Closing Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No stock data
                  </TableCell>
                </TableRow>
              )}
              {data.slice(0, 5).map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.stockGroup.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {parseFloat(r.closingQty).toLocaleString("en-IN")} {r.unit}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
