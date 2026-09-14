import { useTranslation } from "react-i18next"
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts"
import type { AnalysisSection } from "./measuring-types"
import { formatPercent } from "./measuring-utils"
import { posteriorDistribution } from "./posterior-distribution"

export function PosteriorCharts({
  section,
  controlVariant,
  variantNames,
}: {
  section: AnalysisSection
  controlVariant: string
  variantNames: Record<string, string>
}) {
  const { t } = useTranslation()
  const control =
    section.rows.find((row) => row.isControl)?.variant ?? controlVariant
  const treatments = section.rows.flatMap((row) => {
    if (row.isControl || row.variant === control) return []
    const distribution = posteriorDistribution(row)
    return distribution ? [{ variant: row.variant, ...distribution }] : []
  })
  if (!treatments.length) return null
  const min = Math.min(...treatments.map((treatment) => treatment.min))
  const max = Math.max(...treatments.map((treatment) => treatment.max))
  const roughStep = (max - min) / 4
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const fraction = roughStep / magnitude
  const step =
    (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * magnitude
  const axisMin = Math.floor(min / step) * step
  const axisMax = Math.ceil(max / step) * step
  const ticks = Array.from(
    { length: Math.round((axisMax - axisMin) / step) + 1 },
    (_, index) => axisMin + index * step
  )

  return (
    <div className="space-y-2 pt-2">
      <div className="space-y-1">
        <h5 className="text-xs font-medium text-muted-foreground">
          {t(
            "releaseDecision.experiments.detailsPage.measuring.posteriorTitle"
          )}
        </h5>
        <p className="text-xs text-muted-foreground">
          {t(
            "releaseDecision.experiments.detailsPage.measuring.posteriorApproximation"
          )}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {treatments.map(({ variant, mean, lower, upper, points }) => {
          const comparison = t(
            "releaseDecision.experiments.detailsPage.measuring.posteriorComparison",
            {
              treatment: variantNames[variant] ?? variant,
              control: variantNames[control] ?? control,
            }
          )
          const effect = `${mean > 0 ? "+" : ""}${formatPercent(mean)}`

          return (
            <figure key={variant} className="min-w-0 space-y-1">
              <figcaption className="text-xs font-medium break-words text-muted-foreground">
                {comparison}
              </figcaption>
              <div
                role="img"
                aria-label={t(
                  "releaseDecision.experiments.detailsPage.measuring.posteriorDescription",
                  {
                    comparison,
                    effect,
                    lower: formatPercent(lower),
                    upper: formatPercent(upper),
                  }
                )}
                className="h-40 w-full text-primary"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={points}
                    margin={{ top: 8, right: 44, bottom: 0, left: 44 }}
                    accessibilityLayer={false}
                  >
                    <XAxis
                      dataKey="effect"
                      type="number"
                      domain={[axisMin, axisMax]}
                      ticks={ticks}
                      tickFormatter={formatPercent}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: "var(--border)" }}
                    />
                    <YAxis hide domain={[0, 1.05]} />
                    <Area
                      dataKey="interval"
                      type="monotone"
                      stroke="none"
                      fill="currentColor"
                      fillOpacity={0.15}
                      isAnimationActive={false}
                    />
                    {axisMin <= 0 && axisMax >= 0 ? (
                      <ReferenceLine
                        className="posterior-zero"
                        x={0}
                        stroke="var(--muted-foreground)"
                        strokeDasharray="3 3"
                      />
                    ) : null}
                    {[lower, upper].map((bound, index) => (
                      <ReferenceLine
                        key={index}
                        className="posterior-interval-boundary"
                        x={bound}
                        stroke="currentColor"
                        strokeOpacity={0.4}
                        strokeDasharray="3 3"
                        label={{
                          className: "posterior-interval-label",
                          value: formatPercent(bound),
                          // Place labels outside the interval so even narrow
                          // intervals on a shared axis have distinct labels.
                          position:
                            index === 0 ? "insideTopRight" : "insideTopLeft",
                          fill: "var(--foreground)",
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      />
                    ))}
                    <ReferenceLine
                      className="posterior-mean"
                      x={mean}
                      stroke="currentColor"
                      strokeOpacity={0.6}
                    />
                    <Line
                      dataKey="density"
                      type="monotone"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {t(
                  "releaseDecision.experiments.detailsPage.measuring.posteriorSummary",
                  {
                    effect,
                    lower: formatPercent(lower),
                    upper: formatPercent(upper),
                  }
                )}
              </p>
            </figure>
          )
        })}
      </div>
    </div>
  )
}
