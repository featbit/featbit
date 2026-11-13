import { Controller, type UseFormReturn } from "react-hook-form"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { CustomListInput } from "./custom-list-input"
import {
  DescriptionContent,
  DescriptionEditor,
} from "../documentation/components/description-editor"
import { FieldError } from "../documentation/components/documentation-ui"
import { useDocumentationCopy } from "../documentation/use-documentation-copy"
import {
  controlText,
  toLocalDatetime,
  type CustomField,
  type CustomFieldValues,
  type FlagSettingsFormValues,
} from "./custom-fields-model"

export function CustomFieldInputs({
  fields,
  form,
  disabled,
}: {
  fields: CustomField[]
  form: UseFormReturn<FlagSettingsFormValues>
  disabled: boolean
}) {
  const { t } = useDocumentationCopy()
  if (!fields.length)
    return (
      <div className="py-10 text-center">
        <p className="text-sm font-medium">{t("noFields")}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("noFieldsHelp")}
        </p>
      </div>
    )
  return (
    <div className="divide-y">
      {fields.map((field) => (
        <section
          key={field.id}
          aria-label={field.name}
          className="space-y-4 py-5 first:pt-0 last:pb-0"
          data-testid={`custom-field-${field.id}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">{field.name}</h3>
              {field.required ? (
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {t("required")}
                </Badge>
              ) : null}
            </div>
          </div>
          {field.controls.map((control) => {
            const path = `customFields.${field.id}.${control.id}` as const
            const id = `custom-value-${field.id}-${control.id}`
            const error =
              form.formState.errors.customFields?.[field.id]?.[control.id]
                ?.message
            return (
              <div key={`${control.id}:${control.type}`} className="space-y-2">
                {control.type !== "checkbox" ? (
                  <Label htmlFor={id} className="text-xs text-muted-foreground">
                    {control.label}
                  </Label>
                ) : null}
                <Controller
                  control={form.control}
                  name={path}
                  defaultValue={
                    control.type === "list"
                      ? []
                      : control.type === "checkbox"
                        ? false
                        : control.type === "number"
                          ? null
                          : ""
                  }
                  render={({ field: input }) => {
                    if (control.type === "list")
                      return (
                        <CustomListInput
                          id={id}
                          options={control.options ?? []}
                          value={Array.isArray(input.value) ? input.value : []}
                          disabled={disabled}
                          invalid={!!error}
                          onChange={input.onChange}
                          onBlur={input.onBlur}
                        />
                      )
                    if (control.type === "markdown")
                      return (
                        <DescriptionEditor
                          id={id}
                          value={
                            typeof input.value === "string" ? input.value : ""
                          }
                          onChange={input.onChange}
                          disabled={disabled}
                          invalid={!!error}
                          initialMode="preview"
                          compact
                        />
                      )
                    if (control.type === "checkbox")
                      return (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={id}
                            disabled={disabled}
                            checked={input.value === true}
                            onCheckedChange={input.onChange}
                            aria-invalid={!!error}
                          />
                          <Label htmlFor={id}>{control.label}</Label>
                        </div>
                      )
                    if (control.type === "number")
                      return (
                        <Input
                          id={id}
                          type="number"
                          step="any"
                          disabled={disabled}
                          value={
                            typeof input.value === "number" ? input.value : ""
                          }
                          onChange={(event) =>
                            input.onChange(
                              event.target.value === ""
                                ? null
                                : event.target.valueAsNumber
                            )
                          }
                          onBlur={input.onBlur}
                          ref={input.ref}
                          aria-invalid={!!error}
                        />
                      )
                    return (
                      <Input
                        id={id}
                        type="datetime-local"
                        disabled={disabled}
                        value={toLocalDatetime(input.value)}
                        onChange={(event) => {
                          const date = new Date(event.target.value)
                          input.onChange(
                            Number.isFinite(date.getTime())
                              ? date.toISOString()
                              : ""
                          )
                        }}
                        onBlur={input.onBlur}
                        ref={input.ref}
                        aria-invalid={!!error}
                      />
                    )
                  }}
                />
                <FieldError
                  message={typeof error === "string" ? error : undefined}
                />
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}

export function CustomFieldContent({
  field,
  values,
}: {
  field: CustomField
  values: CustomFieldValues
}) {
  const { t, i18n } = useDocumentationCopy()
  return (
    <div className="space-y-4">
      {field.controls.map((control) => {
        const value = values[field.id]?.[control.id]
        return (
          <div key={control.id}>
            <p className="mb-1 text-xs font-medium">{control.label}</p>
            <div className="max-h-48 overflow-auto text-xs leading-5 break-words whitespace-pre-wrap">
              {control.type === "markdown" &&
              typeof value === "string" &&
              value.trim() ? (
                <DescriptionContent value={value} />
              ) : (
                <span
                  className={
                    value === null || value === undefined || value === ""
                      ? "text-muted-foreground"
                      : undefined
                  }
                >
                  {control.type === "checkbox"
                    ? t(value === true ? "checked" : "unchecked")
                    : controlText(control, value, i18n.resolvedLanguage) ||
                      t("notRecorded")}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
