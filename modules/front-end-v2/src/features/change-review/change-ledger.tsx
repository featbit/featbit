import { ArrowDown, ChevronDown, ChevronUp } from "lucide-react"
import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  ChangeLedgerLayout,
  ChangeReviewAction,
  ChangeReviewItem,
  ChangeReviewValueGroup,
} from "./change-review-types"

const layoutColumns: Record<
  ChangeLedgerLayout,
  { row: string; groupedRow: string; groupedOperation: string }
> = {
  settings: {
    row: "grid-cols-[6.875rem_5.625rem_minmax(0,1fr)]",
    groupedRow: "grid-cols-[6.875rem_minmax(0,1fr)]",
    groupedOperation: "grid-cols-[5.625rem_minmax(0,1fr)]",
  },
  targeting: {
    row: "grid-cols-[minmax(10.625rem,11.875rem)_6rem_minmax(0,1fr)]",
    groupedRow: "grid-cols-[minmax(10.625rem,11.875rem)_minmax(0,1fr)]",
    groupedOperation: "grid-cols-[6rem_minmax(0,1fr)]",
  },
  history: {
    row: "grid-cols-[minmax(11.25rem,13.75rem)_6.25rem_minmax(0,1fr)]",
    groupedRow: "grid-cols-[minmax(11.25rem,13.75rem)_minmax(0,1fr)]",
    groupedOperation: "grid-cols-[6.25rem_minmax(0,1fr)]",
  },
}

export type ChangeLedgerCopy<TChange extends ChangeReviewItem> = {
  label: (change: TChange) => string
  action: (action: ChangeReviewAction) => string
  actionCount: (
    action: ChangeReviewValueGroup["action"],
    count: number
  ) => string
  showMore: (count: number) => string
  showLess: string
}

export type ChangeLedgerProps<TChange extends ChangeReviewItem> = {
  changes: TChange[]
  layout: ChangeLedgerLayout
  copy: ChangeLedgerCopy<TChange>
  className?: string
  renderLabel?: (change: TChange) => ReactNode | undefined
  renderContent?: (change: TChange) => ReactNode | undefined
}

export function ChangePair({
  previous,
  current,
}: {
  previous: string
  current: string
}) {
  return (
    <div className="space-y-1">
      <p className="break-words text-muted-foreground">{previous || "—"}</p>
      <ArrowDown className="size-3.5 text-muted-foreground" />
      <p className="break-words">{current || "—"}</p>
    </div>
  )
}

export function ChangeLedger<TChange extends ChangeReviewItem>({
  changes,
  layout,
  copy,
  className,
  renderLabel,
  renderContent,
}: ChangeLedgerProps<TChange>) {
  const columns = layoutColumns[layout]
  const previewLimit = layout === "settings" ? 3 : 2
  const [expandedValues, setExpandedValues] = useState<Record<string, boolean>>(
    {}
  )

  function valuesContent(values: string[], key: string) {
    const expanded = expandedValues[key]
    const visible = expanded ? values : values.slice(0, previewLimit)
    return (
      <div className="min-w-0 text-sm">
        <span className="break-words">{visible.join(", ") || "—"}</span>
        {values.length > previewLimit ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-1 h-7 gap-1 px-2 align-middle text-xs font-medium"
            onClick={() =>
              setExpandedValues((current) => ({
                ...current,
                [key]: !current[key],
              }))
            }
          >
            {expanded
              ? copy.showLess
              : copy.showMore(values.length - previewLimit)}
            {expanded ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "max-h-[45vh] space-y-1 overflow-y-auto rounded-md bg-muted/40 p-3",
        className
      )}
    >
      {changes.map((change, index) => {
        const key = `${change.kind}-${change.label}-${change.action}-${index}`
        if (change.valueGroups?.length) {
          return (
            <div
              key={key}
              className={cn(
                "grid gap-x-4 px-2 py-2.5 text-sm",
                columns.groupedRow
              )}
            >
              <span className="block min-w-0 truncate">
                {renderLabel?.(change) ?? copy.label(change)}
              </span>
              <div className="space-y-2">
                {change.valueGroups.map((group, groupIndex) => (
                  <div
                    key={`${group.action}-${groupIndex}`}
                    className={cn(
                      "grid min-w-0 gap-x-4",
                      columns.groupedOperation
                    )}
                  >
                    <span className="text-muted-foreground">
                      {copy.actionCount(group.action, group.values.length)}
                    </span>
                    {valuesContent(group.values, `${key}-${groupIndex}`)}
                  </div>
                ))}
              </div>
            </div>
          )
        }

        const customContent = renderContent?.(change)
        return (
          <div
            key={key}
            className={cn("grid gap-x-4 px-2 py-2.5 text-sm", columns.row)}
          >
            <div className="min-w-0 self-start">
              {renderLabel?.(change) ?? (
                <span className="block truncate">{copy.label(change)}</span>
              )}
            </div>
            <span className="self-start text-muted-foreground">
              {change.action ? copy.action(change.action) : null}
            </span>
            <div className="min-w-0">
              {customContent !== undefined ? (
                customContent
              ) : change.values?.length ? (
                valuesContent(change.values, key)
              ) : change.previous !== undefined &&
                change.current !== undefined ? (
                <ChangePair
                  previous={change.previous}
                  current={change.current}
                />
              ) : (
                <p className="break-words">
                  {change.current ?? change.previous ?? "—"}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
