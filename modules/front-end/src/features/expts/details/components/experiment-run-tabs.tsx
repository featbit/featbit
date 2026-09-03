import { ChevronLeft, ChevronRight } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { ExperimentRunDetail } from "../experiment-details-types"

function decisionLabel(decision: string) {
  return decision
    .trim()
    .toLowerCase()
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function statusDot(status: string) {
  const normalized = status.trim().toLowerCase()
  if (normalized === "decided") return "bg-emerald-600"
  if (normalized === "collecting") return "bg-blue-600"
  if (normalized === "analyzing") return "bg-violet-600"
  return "bg-zinc-400"
}

export function ExperimentRunTabs({
  runs,
  selectedRunId,
  onSelectedRunChange,
  className,
  listClassName,
}: {
  runs: ExperimentRunDetail[]
  selectedRunId: string
  onSelectedRunChange: (runId: string) => void
  className?: string
  listClassName?: string
}) {
  const { t } = useTranslation()
  const viewportRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef(new Map<string, HTMLButtonElement>())
  const [overflow, setOverflow] = useState({ left: false, right: false })

  const updateOverflow = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth
    setOverflow({
      left: viewport.scrollLeft > 1,
      right: viewport.scrollLeft < maxScrollLeft - 1,
    })
  }, [])

  const scrollTabs = (direction: -1 | 1) => {
    const viewport = viewportRef.current
    if (!viewport) return

    viewport.scrollBy({
      left: direction * Math.max(viewport.clientWidth * 0.75, 320),
      behavior: "smooth",
    })
  }

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    updateOverflow()
    viewport.addEventListener("scroll", updateOverflow, { passive: true })
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateOverflow)
    resizeObserver?.observe(viewport)
    window.addEventListener("resize", updateOverflow)

    return () => {
      viewport.removeEventListener("scroll", updateOverflow)
      resizeObserver?.disconnect()
      window.removeEventListener("resize", updateOverflow)
    }
  }, [runs.length, updateOverflow])

  useEffect(() => {
    tabRefs.current.get(selectedRunId)?.scrollIntoView?.({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    })
    const frame = requestAnimationFrame(updateOverflow)
    return () => cancelAnimationFrame(frame)
  }, [selectedRunId, updateOverflow])

  if (!runs.length) return null

  return (
    <div className={cn("relative", className)}>
      {overflow.left ? (
        <div className="pointer-events-none absolute inset-y-px left-0 z-10 flex w-16 items-center bg-linear-to-r from-background via-background/95 to-transparent pl-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="pointer-events-auto rounded-full bg-background"
            aria-label={t(
              "releaseDecision.experiments.detailsPage.measuring.previousRuns"
            )}
            onClick={() => scrollTabs(-1)}
          >
            <ChevronLeft />
          </Button>
        </div>
      ) : null}
      <div
        ref={viewportRef}
        className="[scrollbar-width:none] overflow-x-auto overflow-y-hidden scroll-smooth [&::-webkit-scrollbar]:hidden"
      >
        <Tabs value={selectedRunId} onValueChange={onSelectedRunChange}>
          <TabsList
            className={cn(
              "w-max min-w-full justify-start gap-0 rounded-none border-t bg-transparent p-0 group-data-horizontal/tabs:h-auto",
              listClassName
            )}
          >
            {runs.map((run) => {
              const status = run.status.trim().toLowerCase()
              const decision = run.decision?.trim().toLowerCase()

              return (
                <TabsTrigger
                  key={run.id}
                  value={run.id}
                  ref={(node) => {
                    if (node) tabRefs.current.set(run.id, node)
                    else tabRefs.current.delete(run.id)
                  }}
                  className="h-11 min-w-52 flex-none justify-between gap-4 rounded-none border-0 border-r border-border px-4 font-normal text-foreground last:border-r-0 hover:bg-muted/40 focus-visible:z-20 data-active:bg-blue-50/60 data-active:shadow-none data-active:after:bottom-0 data-active:after:bg-blue-600 data-active:after:opacity-100 dark:data-active:bg-blue-950/25"
                >
                  <code className="font-medium text-foreground">
                    {run.slug}
                  </code>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          statusDot(status)
                        )}
                      />
                      {t(
                        `releaseDecision.experiments.detailsPage.measuring.statuses.${status}`,
                        { defaultValue: run.status }
                      )}
                    </span>
                    {decision ? (
                      <span className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-amber-500" />
                        {t(
                          `releaseDecision.experiments.detailsPage.measuring.decisions.${decision}`,
                          { defaultValue: decisionLabel(run.decision!) }
                        )}
                      </span>
                    ) : null}
                  </span>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
      </div>
      {overflow.right ? (
        <div className="pointer-events-none absolute inset-y-px right-0 z-10 flex w-16 items-center justify-end bg-linear-to-l from-background via-background/95 to-transparent pr-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="pointer-events-auto rounded-full bg-background"
            aria-label={t(
              "releaseDecision.experiments.detailsPage.measuring.nextRuns"
            )}
            onClick={() => scrollTabs(1)}
          >
            <ChevronRight />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
