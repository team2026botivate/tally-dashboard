import { useState, useEffect } from "react"
import api from "@/lib/api"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface BalanceRow {
  category: string
  balance: number
}

export function SectionCards() {
  const [assets, setAssets] = useState<number | null>(null)
  const [liabilities, setLiabilities] = useState<number | null>(null)
  const [ledgerCount, setLedgerCount] = useState<number | null>(null)
  const [voucherCount, setVoucherCount] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      api.get("/dashboard/balance-sheet"),
      api.get("/dashboard/trial-balance"),
      api.get("/dashboard/recent-vouchers?limit=1000"),
    ]).then(([bsRes, tbRes, rvRes]) => {
      const data = bsRes.data as BalanceRow[]
      setAssets(data.find((r: BalanceRow) => r.category === "Assets")?.balance ?? 0)
      setLiabilities(data.find((r: BalanceRow) => r.category === "Liabilities")?.balance ?? 0)
      setLedgerCount(tbRes.data.length)
      setVoucherCount(rvRes.data.length)
    }).catch(() => {})
  }, [])

  function fmt(n: number | null) {
    if (n === null) return null
    return new Intl.NumberFormat("en-IN").format(n)
  }

  const cards = [
    { label: "Total Assets", value: fmt(assets), loading: assets === null },
    { label: "Total Liabilities", value: fmt(liabilities), loading: liabilities === null },
    { label: "Total Ledgers", value: fmt(ledgerCount), loading: ledgerCount === null },
    { label: "Vouchers", value: fmt(voucherCount), loading: voucherCount === null },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="@container/card">
          <CardHeader>
            <CardDescription>{card.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {card.loading ? <Skeleton className="h-8 w-24" /> : card.value}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
