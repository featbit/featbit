import { ExternalLink, Plus, RefreshCw, Trash2 } from "lucide-react"
import {
  Controller,
  useFieldArray,
  useWatch,
  type UseFormReturn,
} from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { localizedProjectEnvPath } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import { newAlertRule, type BindingFormValues } from "./binding-form"
import { BindingRuleFields, BindingSelect } from "./binding-rule-fields"
import type { useBindingWebhooks } from "./binding-webhooks"

export function BindingAlertRules({
  form,
  unit,
  webhooks,
  projectId,
  envId,
  lang,
}: {
  form: UseFormReturn<BindingFormValues>
  unit: string
  webhooks: ReturnType<typeof useBindingWebhooks>
  projectId: string
  envId: string
  lang: Lang
}) {
  const { t } = useTranslation()
  const b = (key: string) => t("releaseHealth.binding." + key)
  const {
    control,
    register,
    formState: { errors },
  } = form
  const { fields, append, remove } = useFieldArray({
    control,
    name: "rules",
    keyName: "fieldKey",
  })
  const rules = useWatch({ control, name: "rules" })
  const addRule = () => {
    let count = fields.length + 1
    const name = () => t("releaseHealth.binding.ruleNumber", { count })
    while (
      rules.some(
        (rule) =>
          rule.name.trim().toLocaleLowerCase() === name().toLocaleLowerCase()
      )
    )
      count++
    append(newAlertRule(name()), { focusName: `rules.${fields.length}.name` })
  }
  return (
    <section className="space-y-4" aria-label={b("alertRules")}>
      <div className="space-y-1">
        <h3 className="text-sm font-medium">{b("alertRules")}</h3>
        <p className="text-xs leading-5 text-muted-foreground">
          {b("rulesHelp")}
        </p>
      </div>
      {fields.map((field, index) => {
        const ruleErrors = errors.rules?.[index]
        const hook = webhooks.data?.find(
          (item) => item.id === rules[index]?.webhookId
        )
        const title = t("releaseHealth.binding.ruleNumber", {
          count: index + 1,
        })
        const prefix = `binding-rule-${index}`
        return (
          <fieldset
            key={field.fieldKey}
            className="min-w-0 space-y-4 rounded-lg border p-4"
          >
            <legend className="px-1 text-sm font-medium">{title}</legend>
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor={prefix + "-name"}>{b("ruleName")}</Label>
                <Input
                  id={prefix + "-name"}
                  {...register(`rules.${index}.name`)}
                  maxLength={80}
                  aria-invalid={Boolean(ruleErrors?.name)}
                />
                {ruleErrors?.name && (
                  <p role="alert" className="text-xs text-destructive">
                    {ruleErrors.name.message}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="mt-6"
                disabled={fields.length === 1}
                title={b(fields.length === 1 ? "keepOneRule" : "removeRule")}
                aria-label={t("releaseHealth.binding.removeRuleFor", {
                  name: rules[index]?.name || title,
                })}
                onClick={() => remove(index)}
              >
                <Trash2 />
              </Button>
            </div>
            <BindingRuleFields
              control={control}
              register={register}
              errors={errors}
              index={index}
              unit={unit}
            />
            <div className="space-y-2 border-t pt-4">
              <Controller
                control={control}
                name={`rules.${index}.webhookId`}
                render={({ field }) => (
                  <BindingSelect
                    id={prefix + "-webhook"}
                    label={b("webhook")}
                    value={field.value}
                    onChange={field.onChange}
                    disabled={webhooks.isPending || webhooks.isError}
                    invalid={Boolean(ruleErrors?.webhookId)}
                    placeholder={b(
                      webhooks.isPending ? "loadingWebhooks" : "selectWebhook"
                    )}
                    options={(webhooks.data ?? []).map((hook) => ({
                      value: hook.id,
                      label: hook.name,
                    }))}
                  />
                )}
              />
              {hook && (
                <p className="font-mono text-xs break-all text-muted-foreground">
                  {hook.url}
                </p>
              )}
              {ruleErrors?.webhookId && (
                <p role="alert" className="text-xs text-destructive">
                  {ruleErrors.webhookId.message}
                </p>
              )}
              <p className="text-xs leading-5 text-muted-foreground">
                {b("webhookHelp")}
              </p>
            </div>
          </fieldset>
        )
      })}
      {errors.rules?.root && (
        <p role="alert" className="text-xs text-destructive">
          {errors.rules.root.message}
        </p>
      )}
      <Button type="button" variant="outline" size="sm" onClick={addRule}>
        <Plus />
        {b("addRule")}
      </Button>
      <div className="space-y-3 border-t pt-4">
        {webhooks.isError ? (
          <p role="alert" className="text-xs text-destructive">
            {b("webhooksError")}
          </p>
        ) : (
          !webhooks.isPending &&
          !webhooks.data?.length && (
            <p className="text-xs text-muted-foreground">{b("noWebhooks")}</p>
          )
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link
                to={localizedProjectEnvPath(
                  lang,
                  "/webhooks?category=release-health&create=1",
                  {
                    projectId,
                    envId,
                  }
                )}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <ExternalLink />
            {b("createWebhook")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={webhooks.isFetching}
            onClick={() => void webhooks.refetch()}
          >
            <RefreshCw />
            {b("refreshWebhooks")}
          </Button>
        </div>
      </div>
    </section>
  )
}
