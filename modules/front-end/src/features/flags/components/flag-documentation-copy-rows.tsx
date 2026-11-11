import { ArrowDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { CustomFieldContent } from "../custom-fields/custom-field-inputs"
import type {
  DocumentationSettingKey,
  DocumentationRecord,
  CustomField,
} from "../custom-fields/custom-fields-model"
import { DescriptionContent } from "../documentation/components/description-editor"
import { useDocumentationCopy } from "../documentation/use-documentation-copy"
import type { useDocumentationComparison } from "./use-documentation-comparison"

function DocumentationValue({
  record,
  field,
}: {
  record: DocumentationRecord
  field?: CustomField
}) {
  const { t } = useDocumentationCopy()
  if (field)
    return <CustomFieldContent field={field} values={record.customFields} />
  return (
    <div className="max-h-56 overflow-auto text-xs leading-5 break-words">
      {record.general.description.trim() ? (
        <DescriptionContent value={record.general.description} />
      ) : (
        <span className="text-muted-foreground">{t("notRecorded")}</span>
      )}
    </div>
  )
}

export function FlagDocumentationCopyRows({
  comparison,
  selected,
  disabled,
  toggle,
}: {
  comparison: ReturnType<typeof useDocumentationComparison>
  selected: ReadonlySet<string>
  disabled: boolean
  toggle: (key: DocumentationSettingKey) => void
}) {
  const { t } = useTranslation()
  const { t: d } = useDocumentationCopy()
  if (!comparison.ready || !comparison.source || !comparison.target)
    return (
      <div className="border-b px-5 py-5 text-sm text-muted-foreground">
        {t(
          comparison.loading
            ? "common.loading"
            : "featureFlags.differencesSheet.documentationLoadFailed"
        )}
      </div>
    )
  return comparison.rows.map((row) => {
    const chosen = selected.has(row.key)
    const error = comparison.errorFor(row.key)
    const name = row.key === "description" ? d("description") : row.name
    return (
      <div
        key={row.key}
        data-testid={`compare-setting-${row.key}`}
        className={cn(
          "grid grid-cols-[220px_minmax(280px,1fr)_minmax(280px,1fr)] border-b",
          chosen && "bg-primary/[0.035]"
        )}
      >
        <div className="px-5 py-5">
          <div className="flex items-start gap-3">
            <Checkbox
              aria-label={name}
              checked={chosen}
              disabled={disabled || !row.different || Boolean(error)}
              onCheckedChange={() => toggle(row.key)}
            />
            <div>
              <p className="text-sm font-medium">{name}</p>
              <p
                className={cn(
                  "mt-1 text-xs",
                  row.different
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground"
                )}
              >
                {t(
                  `featureFlags.differencesSheet.${row.different ? "different" : "noDifference"}`
                )}
              </p>
            </div>
          </div>
          {error ? (
            <p className="mt-3 text-xs text-muted-foreground" role="note">
              {error}
            </p>
          ) : null}
        </div>
        <div className="px-5 py-5">
          <DocumentationValue
            record={comparison.source!}
            field={row.sourceField}
          />
        </div>
        <div className="px-5 py-5">
          {row.sourceField && !row.targetField ? (
            <p className="text-xs text-muted-foreground">
              {d("incompatibleField")}
            </p>
          ) : (
            <DocumentationValue
              record={comparison.target!}
              field={row.targetField}
            />
          )}
          {chosen ? (
            <div className="mt-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary">
                <ArrowDown className="size-3.5" />
                {t("featureFlags.differencesSheet.afterCopy")}
              </p>
              <div className="rounded-md bg-primary/5 p-3">
                <DocumentationValue
                  record={comparison.source!}
                  field={row.sourceField}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    )
  })
}
