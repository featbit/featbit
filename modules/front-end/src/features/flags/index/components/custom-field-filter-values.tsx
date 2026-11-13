import type { Dispatch, SetStateAction } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DocSelect } from "../../documentation/components/documentation-ui"
import { useDocumentationCopy } from "../../documentation/use-documentation-copy"
import { CustomListInput } from "../../custom-fields/custom-list-input"
import type {
  ComparisonFilterCondition,
  CustomFilterCondition,
  FilterControl,
} from "../../custom-fields/custom-field-filters"

export function CustomFieldFilterValues({
  id,
  control,
  draft,
  setDraft,
  invalid,
}: {
  id: string
  control: FilterControl
  draft: CustomFilterCondition
  setDraft: Dispatch<SetStateAction<CustomFilterCondition>>
  invalid: boolean
}) {
  const { t } = useDocumentationCopy()
  if (control.type === "list" && draft.operator === "any")
    return (
      <div className="space-y-2">
        <Label htmlFor={`${id}-values`}>{t("filters.any")}</Label>
        <CustomListInput
          id={`${id}-values`}
          options={control.options ?? []}
          value={draft.values}
          disabled={false}
          invalid={invalid}
          onBlur={() => {}}
          onChange={(values) => setDraft({ operator: "any", values })}
        />
        <p className="text-xs text-muted-foreground">{t("filters.anyHelp")}</p>
      </div>
    )
  if (draft.operator === "any") return null
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${id}-operator`}>{t("filters.operator")}</Label>
        <DocSelect
          id={`${id}-operator`}
          value={draft.operator}
          options={(["gt", "lt", "range"] as const).map((operator) => ({
            value: operator,
            label: t(`filters.${operator}`),
          }))}
          onChange={(operator) =>
            setDraft((current) =>
              current.operator === "any"
                ? current
                : {
                    ...current,
                    operator: operator as ComparisonFilterCondition["operator"],
                  }
            )
          }
        />
      </div>
      <div className="space-y-3">
        {(
          [
            "from",
            ...(draft.operator === "range" ? (["to"] as const) : []),
          ] as const
        ).map((bound) => (
          <div key={bound} className="space-y-2">
            <Label htmlFor={`${id}-${bound}`}>
              {t(`filters.${draft.operator === "range" ? bound : "value"}`)}
            </Label>
            <Input
              id={`${id}-${bound}`}
              type={control.type === "number" ? "number" : "datetime-local"}
              step={control.type === "number" ? "any" : 60}
              value={draft[bound]}
              onInput={(event) => {
                const value = event.currentTarget.value
                setDraft((current) =>
                  current.operator === "any"
                    ? current
                    : { ...current, [bound]: value }
                )
              }}
            />
          </div>
        ))}
      </div>
    </>
  )
}
