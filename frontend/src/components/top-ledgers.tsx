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

interface LedgerRow {
  name: string
  groupName: string
  currentBalance: string
}

export function TopLedgers() {
  const [data, setData] = useState<LedgerRow[]>([])
  const [loading, setLoading] = useState(true)

  const { activeCompany } = useCompany()

  useEffect(() => {
    if (!activeCompany) return
    api.get(`/dashboard/top-ledgers?limit=5&companyId=${activeCompany.id}`)
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [activeCompany])

  function fmt(amt: string) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency", currency: "INR", minimumFractionDigits: 2,
    }).format(parseFloat(amt) || 0)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Ledgers</CardTitle>
        <CardDescription>Highest balance accounts</CardDescription>
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
                <TableHead>Name</TableHead>
                <TableHead>Group</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No data
                  </TableCell>
                </TableRow>
              )}
              {data.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.groupName}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.currentBalance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
