import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Circle, Flag, Cable } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MetricDetailTable } from "./metric-detail-table"
import type { MetricChange } from "../release-health-api"

export function MetricDetailTimeline({
  events,
  from,
  to,
  loading,
  failed,
}: {
  events: MetricChange[]
  from: number
  to: number
  loading: boolean
  failed: boolean
}) {
  const { t } = useTranslation()
  const d = (key: string) => t(`releaseHealth.live.detail.${key}`)
  const [filter, setFilter] = useState("all")
  const [selected, setSelected] = useState<MetricChange[]>([])
  const track = useRef<HTMLDivElement>(null)
  const [trackWidth, setTrackWidth] = useState(840)
  useEffect(() => {
    if (!track.current) return
    const observer = new ResizeObserver(([entry]) =>
      setTrackWidth(entry.contentRect.width)
    )
    observer.observe(track.current)
    return () => observer.disconnect()
  }, [])
  const buckets = Math.max(1, Math.floor(trackWidth / 28))
  const kinds = [
    { key: "metric", label: "metricChanges", icon: Circle },
    { key: "source_binding", label: "sourceChanges", icon: Cable },
    { key: "flag", label: "flagChanges", icon: Flag },
  ]
  const visible = events.filter((x) => filter === "all" || x.kind === filter)
  return (
    <Card role="region" aria-labelledby="metric-timeline-heading">
      <CardContent>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h2 id="metric-timeline-heading" className="text-base font-medium">
            {d("timeline")}
          </h2>
          <Select
            value={filter}
            onValueChange={(value) => value && setFilter(value)}
          >
            <SelectTrigger className="w-44" aria-label={d("timeline")}>
              <SelectValue>
                {d(
                  filter === "all"
                    ? "allChanges"
                    : kinds.find((x) => x.key === filter)!.label
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">{d("allChanges")}</SelectItem>
                {kinds.map((x) => (
                  <SelectItem key={x.key} value={x.key}>
                    {d(x.label)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          {d("timelineHelp")}
        </p>
        <div
          ref={track}
          className="space-y-3 pr-5 pl-[70px]"
          aria-label={d("timeline")}
        >
          {kinds
            .filter((kind) => filter === "all" || filter === kind.key)
            .map(({ key, icon: Icon, label }) => {
              const groups = new Map<number, MetricChange[]>()
              for (const event of visible.filter((x) => x.kind === key)) {
                const bucket = Math.round(
                  ((Date.parse(event.occurredAt) - from) / (to - from)) *
                    buckets
                )
                groups.set(bucket, [...(groups.get(bucket) ?? []), event])
              }
              return (
                <div key={key} className="relative h-7 border-b border-border">
                  <span
                    className="absolute top-1 right-full mr-3"
                    title={d(label)}
                  >
                    <Icon className="size-4 text-muted-foreground" />
                  </span>
                  {[...groups.entries()].map(([bucket, entries]) => (
                    <button
                      key={bucket}
                      type="button"
                      className="absolute bottom-0 flex size-6 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border-2 border-background bg-primary text-[10px] font-medium text-primary-foreground shadow-sm hover:ring-2 hover:ring-ring focus-visible:outline-2 focus-visible:outline-ring"
                      style={{
                        left: `${Math.max(0, Math.min(100, (bucket / buckets) * 100))}%`,
                      }}
                      aria-label={`${d(label)} · ${new Date(entries[0].occurredAt).toLocaleString()} · ${t("releaseHealth.live.detail.changeCount", { count: entries.length })}`}
                      title={`${d(label)} · ${new Date(entries[0].occurredAt).toLocaleString()} · ${entries[0].actorName}`}
                      onClick={() => setSelected(entries)}
                    >
                      {entries.length > 1 ? (
                        entries.length
                      ) : (
                        <Icon className="size-3" />
                      )}
                    </button>
                  ))}
                </div>
              )
            })}
          <div className="flex justify-between pt-2 text-[11px] text-muted-foreground">
            <span>{new Date(from).toLocaleString()}</span>
            <span>{new Date(to).toLocaleString()}</span>
          </div>
        </div>
        {(loading || failed || !visible.length) && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {d(
              loading ? "loading" : failed ? "changesUnavailable" : "noChanges"
            )}
          </p>
        )}
        <Dialog
          open={selected.length > 0}
          onOpenChange={(open) => !open && setSelected([])}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{d("changeDetails")}</DialogTitle>
            </DialogHeader>
            {selected.map((event) => (
              <section
                key={event.id}
                className="space-y-4 border-b pb-5 last:border-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {d(
                      kinds.find((x) => x.key === event.kind)?.label ??
                        "metricChanges"
                    )}
                  </Badge>
                  <span className="font-medium">
                    {t(`releaseHealth.live.detail.${event.operation}`, {
                      defaultValue: event.operation,
                    })}
                  </span>
                  <Badge variant="outline">v{event.metricVersion}</Badge>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">{d("actor")}</dt>
                    <dd>{event.actorName}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{d("origin")}</dt>
                    <dd>{event.source}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{d("occurred")}</dt>
                    <dd>{new Date(event.occurredAt).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{d("scope")}</dt>
                    <dd>
                      {d(event.environmentId ? "envScope" : "projectScope")}
                    </dd>
                  </div>
                </dl>
                <div className="overflow-x-auto">
                  <MetricDetailTable
                    headings={[d("field"), d("before"), d("after")]}
                    wrap
                    rows={event.fields.map((field) => ({
                      id: field.field,
                      cells: [
                        t(`releaseHealth.live.detail.fields.${field.field}`, {
                          defaultValue: field.field,
                        }),
                        field.before || "—",
                        field.after || "—",
                      ],
                    }))}
                  />
                </div>
              </section>
            ))}
            <Button variant="outline" onClick={() => setSelected([])}>
              {d("close")}
            </Button>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
