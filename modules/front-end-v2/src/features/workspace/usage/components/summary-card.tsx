import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { compactNumber, getChangePercent } from "../usage-utils"

export function SummaryCard({
  icon: Icon,
  label,
  value,
  previous,
  loading,
  vsLabel,
  accent,
  lang,
}: {
  icon: LucideIcon
  label: string
  value: number
  previous: number
  loading: boolean
  vsLabel: string
  accent: "green" | "blue" | "amber"
  lang: "en" | "zh"
}) {
  const change = getChangePercent(value, previous)

  return (
    <Card>
      <CardContent className="flex items-center gap-5 py-3">
        <div
          className={cn(
            "flex size-14 shrink-0 items-center justify-center rounded-lg",
            accent === "green" && "bg-green-500/10 text-green-600",
            accent === "blue" && "bg-blue-500/10 text-blue-600",
            accent === "amber" && "bg-amber-500/15 text-amber-600"
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {compactNumber(value, lang)}
              </p>
              <p
                className={cn(
                  "mt-1 text-sm",
                  change > 0 && "text-green-600",
                  change < 0 && "text-destructive",
                  change === 0 && "text-muted-foreground"
                )}
              >
                {change > 0 ? "+" : ""}
                {change}%{" "}
                <span className="text-muted-foreground">{vsLabel}</span>
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
