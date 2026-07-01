"use client";

import { useState, useEffect } from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { useCompany } from "@/lib/company-provider"

interface TrendRow {
  date: string
  voucher_type: string
  count: number
  total_amount: string
}

export function ChartAreaInteractive() {
  const [data, setData] = useState<TrendRow[]>([])
  const [loading, setLoading] = useState(true)

  const { activeCompany } = useCompany()

  useEffect(() => {
    if (!activeCompany) return
    fetch(`/api/dashboard/voucher-trends?days=30&companyId=${activeCompany.id}`)
      .then((res) => res.json())
      .then((data) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [activeCompany])

  const byDate: Record<string, { date: string; total: number }> = {}
  for (const row of data) {
    if (!byDate[row.date]) byDate[row.date] = { date: row.date, total: 0 }
    byDate[row.date].total += parseFloat(row.total_amount) || 0
  }
  const chartData = Object.values(byDate).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const chartConfig = {
    total: {
      label: "Total Amount",
      color: "var(--primary)",
    },
  } satisfies ChartConfig

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Voucher Trends</CardTitle>
        <CardDescription>Last 30 days</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {loading ? (
          <Skeleton className="h-[250px] w-full" />
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-total)" stopOpacity={1.0} />
                  <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const d = new Date(value)
                  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString("en-US", {
                        month: "short", day: "numeric",
                      })
                    }}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="total"
                type="natural"
                fill="url(#fillTotal)"
                stroke="var(--color-total)"
                stackId="a"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
