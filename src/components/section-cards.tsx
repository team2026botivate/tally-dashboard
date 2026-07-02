"use client";

import { useCompany } from "@/lib/company-provider"
import { useDashboardCards } from "@/lib/hooks/use-dashboard"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { TrendingUpIcon } from "lucide-react"

export function SectionCards() {
  const { activeCompany } = useCompany()
  const { assets, liabilities, ledgerCount, voucherCount, isLoading } = useDashboardCards(activeCompany?.id)

  function fmt(n: number) {
    return new Intl.NumberFormat("en-IN").format(n)
  }

  const cards = [
    { label: "Total Assets", value: fmt(assets), loading: isLoading },
    { label: "Total Liabilities", value: fmt(liabilities), loading: isLoading },
    { label: "Total Ledgers", value: fmt(ledgerCount), loading: isLoading },
    { label: "Vouchers", value: fmt(voucherCount), loading: isLoading },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="@container/card">
          <CardHeader>
            <CardDescription>{card.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {card.loading ? <Skeleton className="h-8 w-24" /> : card.value}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <TrendingUpIcon />
                Current
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="text-muted-foreground">
              {card.label} from {activeCompany?.companyName || "Tally"}
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
