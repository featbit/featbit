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
import type {
  ObservationDurationUnit,
  ObservationEndMode,
  ObservationWindowDraft,
  ObservationWindowError,
} from "./observation-window-utils"

export function ObservationWindowFields({
  idPrefix,
  value,
  error,
  disabled,
  startDisabled,
  onChange,
}: {
  idPrefix: string
  value: ObservationWindowDraft
  error?: ObservationWindowError | null
  disabled?: boolean
  startDisabled?: boolean
  onChange: (value: ObservationWindowDraft) => void
}) {
  const { t } = useTranslation()
  const key = "releaseDecision.experiments.detailsPage.measuring"

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-start`}>
          {t(`${key}.startDateTime`)}
          <span className="text-destructive"> *</span>
        </Label>
        <Input
          id={`${idPrefix}-start`}
          type="datetime-local"
          required
          value={value.start}
          disabled={disabled || startDisabled}
          aria-invalid={error === "startRequired"}
          onClick={(event) => event.currentTarget.showPicker?.()}
          onChange={(event) =>
            onChange({ ...value, start: event.target.value })
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-end-mode`}>{t(`${key}.end`)}</Label>
        <Select
          value={value.endMode}
          disabled={disabled}
          onValueChange={(mode) =>
            mode && onChange({ ...value, endMode: mode as ObservationEndMode })
          }
        >
          <SelectTrigger id={`${idPrefix}-end-mode`} className="w-full">
            <SelectValue>{t(`${key}.endModes.${value.endMode}`)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {(["open", "duration", "date"] as const).map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {t(`${key}.endModes.${mode}`)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {value.endMode === "duration" ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-duration`}>{t(`${key}.duration`)}</Label>
          <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-2">
            <Input
              id={`${idPrefix}-duration`}
              type="number"
              min={1}
              step={1}
              value={value.duration}
              disabled={disabled}
              aria-invalid={error === "durationInvalid"}
              onChange={(event) =>
                onChange({ ...value, duration: event.target.value })
              }
            />
            <Select
              value={value.durationUnit}
              disabled={disabled}
              onValueChange={(unit) =>
                unit &&
                onChange({
                  ...value,
                  durationUnit: unit as ObservationDurationUnit,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {t(`${key}.durationUnits.${value.durationUnit}`)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {(["hours", "days", "weeks"] as const).map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {t(`${key}.durationUnits.${unit}`)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {value.endMode === "date" ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-end`}>{t(`${key}.endDateTime`)}</Label>
          <Input
            id={`${idPrefix}-end`}
            type="datetime-local"
            min={value.start || undefined}
            value={value.end}
            disabled={disabled}
            aria-invalid={
              error === "endRequired" ||
              error === "endAfterStart" ||
              error === "endCannotShorten"
            }
            onClick={(event) => event.currentTarget.showPicker?.()}
            onChange={(event) =>
              onChange({ ...value, end: event.target.value })
            }
          />
        </div>
      ) : null}

      {error ? (
        <p className="text-xs text-destructive">
          {t(`${key}.windowErrors.${error}`)}
        </p>
      ) : null}
    </div>
  )
}
