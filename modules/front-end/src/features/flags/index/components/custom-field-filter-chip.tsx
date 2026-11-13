import { useId, useState } from "react"
import { CalendarClock, Hash, ListFilter, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { FieldError } from "../../documentation/components/documentation-ui"
import { useDocumentationCopy } from "../../documentation/use-documentation-copy"
import {
  filterConditionIssue,
  type CustomFieldFilter,
  type CustomFilterCondition,
  type FilterControl,
} from "../../custom-fields/custom-field-filters"
import { CustomFieldFilterValues } from "./custom-field-filter-values"

export function CustomFieldFilterIcon({
  type,
}: {
  type: FilterControl["type"]
}) {
  return type === "list" ? (
    <ListFilter />
  ) : type === "number" ? (
    <Hash />
  ) : (
    <CalendarClock />
  )
}

export function CustomFieldFilterChip({
  control,
  filter,
  onApply,
  onRemove,
}: {
  control: FilterControl
  filter: CustomFieldFilter
  onApply: (condition: CustomFilterCondition) => void
  onRemove: () => void
}) {
  const { t, i18n } = useDocumentationCopy()
  const id = useId()
  const initial: CustomFilterCondition =
    filter.condition ??
    (control.type === "list"
      ? { operator: "any", values: [] }
      : { operator: "gt", from: "", to: "" })
  const [open, setOpen] = useState(!filter.condition)
  const [draft, setDraft] = useState(initial)
  const [submitted, setSubmitted] = useState(false)
  const issue = filterConditionIssue(control, draft)
  const format = (value: string) =>
    control.type === "datetime"
      ? new Date(value).toLocaleString(i18n.resolvedLanguage, {
          dateStyle: "short",
          timeStyle: "short",
        })
      : value
  const condition = filter.condition
  const summary = !condition
    ? t("filters.set")
    : condition.operator === "any"
      ? t("filters.anySummary", { values: condition.values.join(", ") })
      : condition.operator === "range"
        ? `${format(condition.from)} – ${format(condition.to)}`
        : `${condition.operator === "gt" ? ">" : "<"} ${format(condition.from)}`
  return (
    <div
      className="inline-flex max-w-full items-center rounded-md border bg-background"
      data-testid="custom-field-filter"
    >
      <Popover
        open={open}
        onOpenChange={(value) => {
          setOpen(value)
          if (value) {
            setDraft(initial)
            setSubmitted(false)
          }
        }}
      >
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              aria-label={t("filters.edit", { field: control.name })}
              title={summary}
              className="max-w-full rounded-r-none font-normal"
            />
          }
        >
          <CustomFieldFilterIcon type={control.type} />
          <span className="truncate">
            {control.name}: <span className="font-medium">{summary}</span>
          </span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 space-y-4">
          <p className="text-sm font-medium">{control.name}</p>
          <CustomFieldFilterValues
            id={id}
            control={control}
            draft={draft}
            setDraft={setDraft}
            invalid={submitted && !!issue}
          />
          <FieldError
            message={submitted && issue ? t(`filters.${issue}`) : undefined}
          />
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              setSubmitted(true)
              if (!issue) {
                onApply(draft)
                setOpen(false)
              }
            }}
          >
            {t("filters.apply")}
          </Button>
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="mr-1"
        aria-label={t("filters.remove", { field: control.name })}
        onClick={onRemove}
      >
        <X />
      </Button>
    </div>
  )
}
