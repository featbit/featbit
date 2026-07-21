import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useId, useMemo, useRef } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  buildResourceRn,
  EMPTY_RESOURCE_RN_VALUES,
  parseResourceRn,
  RESOURCE_RN_PART_LABELS,
  RESOURCE_RN_PARTS,
  type EditableResourceType,
  type ResourcePart,
  type ResourceRnValues,
} from "./resource-rn"

export function ResourceRnEditorDialog({
  open,
  resourceType,
  rn,
  selectedResources,
  onOpenChange,
  onApply,
}: {
  open: boolean
  resourceType: EditableResourceType
  rn: string
  selectedResources: string[]
  onOpenChange: (open: boolean) => void
  onApply: (rn: string) => void
}) {
  const { t } = useTranslation()
  const wildcardDescriptionId = useId()
  const activeParts = RESOURCE_RN_PARTS[resourceType]
  const previousSpecificValues = useRef<Partial<Record<ResourcePart, string>>>(
    {}
  )
  const schema = useMemo(() => {
    const partSchema = (part: ResourcePart) => {
      const label = t(
        `iam.policies.details.permissionsEditor.rnEditor.fields.${RESOURCE_RN_PART_LABELS[part]}`
      )
      return z
        .string()
        .trim()
        .min(
          1,
          t(
            "iam.policies.details.permissionsEditor.rnEditor.validation.required",
            { field: label }
          )
        )
        .refine(
          (value) => !/[{}:]/.test(value),
          t(
            "iam.policies.details.permissionsEditor.rnEditor.validation.invalidCharacters",
            { field: label }
          )
        )
    }

    return z.object({
      project: activeParts.includes("project")
        ? partSchema("project")
        : z.string(),
      env: activeParts.includes("env") ? partSchema("env") : z.string(),
      flag: activeParts.includes("flag") ? partSchema("flag") : z.string(),
      segment: activeParts.includes("segment")
        ? partSchema("segment")
        : z.string(),
      tags: z.string().refine(
        (value) => !/[{}:]/.test(value),
        t(
          "iam.policies.details.permissionsEditor.rnEditor.validation.invalidCharacters",
          {
            field: t(
              "iam.policies.details.permissionsEditor.rnEditor.fields.tags"
            ),
          }
        )
      ),
    })
  }, [activeParts, t])
  const form = useForm<ResourceRnValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: EMPTY_RESOURCE_RN_VALUES,
  })
  const watchedValues = useWatch({ control: form.control })
  const values: ResourceRnValues = {
    project: watchedValues.project ?? "",
    env: watchedValues.env ?? "",
    flag: watchedValues.flag ?? "",
    segment: watchedValues.segment ?? "",
    tags: watchedValues.tags ?? "",
  }
  const nextRn = buildResourceRn(resourceType, values)
  const duplicate =
    nextRn !== rn && selectedResources.some((resource) => resource === nextRn)

  useEffect(() => {
    if (!open) return
    const parsedValues = parseResourceRn(rn)
    previousSpecificValues.current = activeParts.reduce<
      Partial<Record<ResourcePart, string>>
    >((previousValues, part) => {
      if (parsedValues[part] !== "*") {
        previousValues[part] = parsedValues[part]
      }
      return previousValues
    }, {})
    form.reset(parsedValues)
    void form.trigger()
  }, [activeParts, form, open, rn])

  function apply(valuesToApply: ResourceRnValues) {
    const value = buildResourceRn(resourceType, valuesToApply)
    if (value !== rn && selectedResources.includes(value)) return
    onApply(value)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("iam.policies.details.permissionsEditor.rnEditor.title")}
          </DialogTitle>
          <DialogDescription>
            {t("iam.policies.details.permissionsEditor.rnEditor.description")}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.stopPropagation()
            void form.handleSubmit(apply)(event)
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="resource-rn-preview">
              {t(
                "iam.policies.details.permissionsEditor.rnEditor.resourceName"
              )}
            </Label>
            <Input
              id="resource-rn-preview"
              value={nextRn}
              readOnly
              aria-invalid={duplicate || undefined}
              className="bg-muted/50 font-mono text-xs"
            />
            {duplicate ? (
              <p className="text-xs text-destructive">
                {t(
                  "iam.policies.details.permissionsEditor.rnEditor.validation.duplicate"
                )}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t(
                  "iam.policies.details.permissionsEditor.rnEditor.legalCharacters"
                )}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <p
              id={wildcardDescriptionId}
              className="text-xs leading-5 text-muted-foreground"
            >
              {t(
                "iam.policies.details.permissionsEditor.rnEditor.wildcardDescription"
              )}
            </p>
            {activeParts.map((part, index) => {
              const fieldId = `resource-rn-${part}`
              const error = form.formState.errors[part]?.message
              const anySelected = values[part] === "*"
              const registration = form.register(part)
              const label = t(
                `iam.policies.details.permissionsEditor.rnEditor.fields.${RESOURCE_RN_PART_LABELS[part]}`
              )
              return (
                <div key={part} className="space-y-1.5">
                  <Label htmlFor={fieldId}>{label}</Label>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <Input
                      id={fieldId}
                      autoFocus={index === 0}
                      disabled={anySelected}
                      aria-describedby={wildcardDescriptionId}
                      aria-invalid={Boolean(error) || undefined}
                      className="font-mono"
                      {...registration}
                      onChange={(event) => {
                        previousSpecificValues.current[part] =
                          event.currentTarget.value
                        registration.onChange(event)
                      }}
                    />
                    <label className="flex h-8 cursor-pointer items-center gap-2 px-1 text-sm text-foreground sm:min-w-40">
                      <Checkbox
                        checked={anySelected}
                        aria-describedby={wildcardDescriptionId}
                        onCheckedChange={(checked) => {
                          if (checked === true) {
                            const currentValue = form.getValues(part)
                            if (currentValue !== "*") {
                              previousSpecificValues.current[part] =
                                currentValue
                            }
                          }
                          form.setValue(
                            part,
                            checked === true
                              ? "*"
                              : (previousSpecificValues.current[part] ?? ""),
                            {
                              shouldDirty: true,
                              shouldValidate: true,
                            }
                          )
                        }}
                      />
                      {t(
                        `iam.policies.details.permissionsEditor.rnEditor.any.${RESOURCE_RN_PART_LABELS[part]}`
                      )}
                    </label>
                  </div>
                  {error ? (
                    <p className="text-xs text-destructive">{error}</p>
                  ) : null}
                </div>
              )
            })}

            {resourceType === "flag" || resourceType === "segment" ? (
              <div className="space-y-1.5">
                <Label htmlFor="resource-rn-tags">
                  {t(
                    "iam.policies.details.permissionsEditor.rnEditor.fields.tags"
                  )}
                </Label>
                <Input
                  id="resource-rn-tags"
                  aria-invalid={
                    Boolean(form.formState.errors.tags?.message) || undefined
                  }
                  placeholder={t(
                    "iam.policies.details.permissionsEditor.rnEditor.tagsPlaceholder"
                  )}
                  {...form.register("tags")}
                />
                {form.formState.errors.tags?.message ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.tags.message}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("iam.policies.details.permissionsEditor.rnEditor.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!form.formState.isValid || duplicate}
            >
              {t("iam.policies.details.permissionsEditor.rnEditor.apply")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
