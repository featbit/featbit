import type { UseFormRegister } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MAXIMUM_SAMPLE, type MinimumSampleFormValues } from "./minimum-sample"

export function MinimumSampleField({
  id,
  register,
  invalid,
  disabled,
}: {
  id: string
  register: UseFormRegister<MinimumSampleFormValues>
  invalid: boolean
  disabled: boolean
}) {
  const { t } = useTranslation()
  const key = "releaseDecision.experiments.detailsPage.measuring"

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t(`${key}.minimumSamplePerVariant`)}</Label>
      <Input
        {...register("minimumSample")}
        id={id}
        type="number"
        min={0}
        max={MAXIMUM_SAMPLE}
        step={1}
        placeholder={t(`${key}.noMinimumSet`)}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={`${id}-help${invalid ? ` ${id}-error` : ""}`}
      />
      <p id={`${id}-help`} className="text-xs leading-5 text-muted-foreground">
        {t(`${key}.minimumSampleHelp`)}
      </p>
      {invalid ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {t(`${key}.minimumSampleInvalid`)}
        </p>
      ) : null}
    </div>
  )
}
