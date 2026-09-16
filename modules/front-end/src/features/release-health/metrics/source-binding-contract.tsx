import { useTranslation } from "react-i18next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LiveMetric } from "../release-health-api"
import {
  metricResultProfileLabel,
  metricUnitLabel,
  resultContractRange,
} from "./metric-contract"

export function SourceBindingContract({ metric }: { metric: LiveMetric }) {
  const { t } = useTranslation()
  const d = (key: string) => t(`releaseHealth.live.detail.${key}`)
  const contract = metric.resultContract
  const intrinsic = resultContractRange(contract.unit)
  const groups = [
    {
      key: "measurement",
      fields: [
        [
          "kind",
          t(
            `releaseHealth.resultContract.measurementKind.${contract.measurementKind}`
          ),
        ],
        ["unit", metricUnitLabel(t, contract.unit)],
      ],
    },
    {
      key: "shape",
      fields: [
        ["resultKind", d("numericSeries")],
        ["cardinality", d("single")],
        ["profile", metricResultProfileLabel(t, metric)],
      ],
    },
    {
      key: "constraints",
      fields: [
        ["minimum", String(contract.constraints.minimum ?? intrinsic.minimum)],
        [
          "maximum",
          String(contract.constraints.maximum ?? intrinsic.maximum ?? "—"),
        ],
        ["digits", String(metric.fractionDigits ?? 2)],
      ],
    },
  ]
  return (
    <Card
      size="sm"
      className="mb-4 gap-3"
      role="region"
      aria-labelledby="source-contract-heading"
    >
      <CardHeader>
        <CardTitle>
          <h2 id="source-contract-heading">{d("contract")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">{d("semantics")}</p>
          <p className="text-sm leading-5 break-words">
            {metric.resultSemantics}
          </p>
        </div>
        <div className="grid gap-4 border-t pt-3 lg:grid-cols-3 lg:gap-6">
          {groups.map((group) => (
            <section key={group.key}>
              {group.key !== "measurement" && (
                <h3 className="mb-2 text-xs font-medium">{d(group.key)}</h3>
              )}
              <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                {group.fields.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-xs leading-5 text-muted-foreground">
                      {d(label)}
                    </dt>
                    <dd className="min-w-0 break-words">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
