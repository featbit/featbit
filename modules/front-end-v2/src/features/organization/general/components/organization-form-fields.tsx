import type React from "react"
import { useTranslation } from "react-i18next"
import { CopyField } from "@/components/copy-field"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export const ACTION_BUTTON_CLASS = "w-44"

export function Field({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string
  label: string
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} className="block text-sm font-medium">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  )
}

export function OrganizationInput({
  id,
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string
  error?: string
}) {
  return (
    <Input
      id={id}
      aria-invalid={Boolean(error)}
      className={cn(error && "border-destructive", className)}
      {...props}
    />
  )
}

export function ReadonlyCodeField({
  id,
  value,
  label,
  onCopy,
}: {
  id: string
  value: string
  label: string
  onCopy: () => void
}) {
  const { t } = useTranslation()

  return (
    <Field id={id} label={label}>
      <CopyField
        id={id}
        value={value}
        buttonLabel={t("organization.actions.copy")}
        tooltip={t("organization.actions.copyField", { label })}
        onCopy={onCopy}
      />
    </Field>
  )
}

export function OrganizationSelect({
  value,
  options,
  ariaLabel,
  disabled,
  placeholder,
  onChange,
  renderValue,
}: {
  value: string
  options: { value: string; label: string; badge?: string }[]
  ariaLabel: string
  disabled?: boolean
  placeholder?: string
  onChange: (value: string) => void
  renderValue?: (option: {
    value: string
    label: string
    badge?: string
  }) => React.ReactNode
}) {
  const { t } = useTranslation()
  const selected = options.find((option) => option.value === value)

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(nextValue) => {
        if (nextValue) {
          onChange(nextValue)
        }
      }}
    >
      <SelectTrigger aria-label={ariaLabel} className="w-full bg-background">
        <SelectValue>
          {selected
            ? (renderValue?.(selected) ?? selected.label)
            : (placeholder ?? t("organization.select.placeholder"))}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate">{option.label}</span>
              {option.badge ? (
                <Badge
                  variant="outline"
                  className="ml-auto h-5 shrink-0 bg-background px-1.5 text-[0.65rem] font-medium text-muted-foreground"
                >
                  {option.badge}
                </Badge>
              ) : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
