import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BindingFormValues } from "./binding-form"

export function BindingSelect({
  id,
  label,
  value,
  onChange,
  options,
  disabled = false,
  placeholder,
  invalid = false,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string; disabled?: boolean }[]
  disabled?: boolean
  placeholder?: string
  invalid?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value || null}
        onValueChange={(next) => next !== null && onChange(next)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
          <SelectValue placeholder={placeholder}>
            {options.find((item) => item.value === value)?.label ?? placeholder}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((item) => (
              <SelectItem
                key={item.value}
                value={item.value}
                disabled={item.disabled}
              >
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

export function BindingRuleFields({
  control,
  register,
  errors,
  unit,
  index,
}: {
  control: Control<BindingFormValues>
  register: UseFormRegister<BindingFormValues>
  errors: FieldErrors<BindingFormValues>
  unit: string
  index: number
}) {
  const { t } = useTranslation()
  const b = (key: string) => t("releaseHealth.binding." + key)
  const ruleErrors = errors.rules?.[index]
  const prefix = `binding-rule-${index}`
  const select = (
    name: "operator" | "severity" | "reducer",
    values: string[],
    translate = true
  ) => (
    <Controller
      name={`rules.${index}.${name}`}
      control={control}
      render={({ field }) => (
        <BindingSelect
          id={prefix + "-" + name}
          label={b(name)}
          value={field.value}
          onChange={field.onChange}
          options={values.map((value) => ({
            value,
            label: translate ? b(value) : value,
          }))}
        />
      )}
    />
  )
  const duration = (
    name:
      | "lookback"
      | "sustain"
      | "recovery"
      | "evaluationInterval"
      | "warmup"
      | "dataDelay",
    values: number[]
  ) => (
    <Controller
      name={`rules.${index}.${name}`}
      control={control}
      render={({ field }) => (
        <div>
          <BindingSelect
            id={prefix + "-" + name}
            label={b(name)}
            value={String(field.value)}
            onChange={(value) => field.onChange(Number(value))}
            invalid={Boolean(ruleErrors?.[name])}
            options={values.map((value) => ({
              value: String(value),
              label: t("releaseHealth.binding.minutes", { count: value }),
            }))}
          />
          {ruleErrors?.[name] && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {ruleErrors[name]?.message}
            </p>
          )}
        </div>
      )}
    />
  )
  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {duration("lookback", [5, 10, 15, 30, 60])}
        {select("reducer", ["latest", "average", "minimum", "maximum"])}
        {select("operator", [">", ">=", "<", "<="], false)}
        <div className="space-y-2">
          <Label htmlFor={prefix + "-threshold"}>
            {b("threshold")} · {unit}
          </Label>
          <Input
            id={prefix + "-threshold"}
            type="number"
            step="any"
            {...register(`rules.${index}.threshold`)}
            aria-invalid={Boolean(ruleErrors?.threshold)}
          />
          {ruleErrors?.threshold && (
            <p role="alert" className="text-xs text-destructive">
              {ruleErrors.threshold.message}
            </p>
          )}
        </div>
        {select("severity", ["warning", "critical"])}
        {duration("sustain", [1, 5, 10, 15])}
        {duration("recovery", [1, 5, 10, 15])}
        {duration("evaluationInterval", [1, 2, 5])}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        {b("recoveryHelp")}
      </p>
      <details className="rounded-md border p-3">
        <summary className="cursor-pointer text-sm">{b("advanced")}</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {duration("warmup", [0, 5, 10, 15])}
          {duration("dataDelay", [0, 1, 2, 5])}
        </div>
      </details>
    </section>
  )
}
