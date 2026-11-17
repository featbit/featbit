import { useState, type Ref } from "react"
import { format } from "date-fns"
import { enUS, zhCN } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { DocSelect } from "../documentation/components/documentation-ui"
import { useDocumentationCopy } from "../documentation/use-documentation-copy"
import { parseCustomDatetime } from "./custom-datetime"

export function CustomDatetimeInput({
  id,
  value,
  onChange,
  onBlur,
  inputRef,
  disabled = false,
  invalid = false,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  inputRef?: Ref<HTMLInputElement>
  disabled?: boolean
  invalid?: boolean
}) {
  const { t, i18n } = useDocumentationCopy()
  const [open, setOpen] = useState(false)
  const date = parseCustomDatetime(value)
  const locale = i18n.resolvedLanguage?.startsWith("zh") ? zhCN : enUS
  function setTime(part: "hours" | "minutes", next: string) {
    if (!date) return
    const changed = new Date(date)
    if (part === "hours") changed.setHours(Number(next))
    else changed.setMinutes(Number(next))
    onChange(changed.toISOString())
  }
  return (
    <div className="relative">
      <Input
        id={id}
        ref={inputRef}
        type="text"
        lang={locale.code}
        className="pr-10"
        value={
          date ? format(date, "yyyy-MM-dd HH:mm") : value.replace("T", " ")
        }
        placeholder="YYYY-MM-DD HH:mm"
        disabled={disabled}
        aria-invalid={invalid}
        onBlur={onBlur}
        onInput={(event) => {
          const next = event.currentTarget.value.replace(" ", "T")
          const parsed = parseCustomDatetime(next)
          onChange(parsed ? parsed.toISOString() : next)
        }}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled}
              aria-label={t("chooseDateTime")}
              className="absolute top-1/2 right-1 -translate-y-1/2"
            />
          }
        >
          <CalendarIcon className="size-4 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          className="w-auto space-y-3 p-3"
        >
          <Calendar
            mode="single"
            locale={locale}
            selected={date}
            defaultMonth={date}
            onSelect={(selected) => {
              if (!selected) return
              const chosen = new Date(selected)
              chosen.setHours(
                date?.getHours() ?? 0,
                date?.getMinutes() ?? 0,
                0,
                0
              )
              onChange(chosen.toISOString())
            }}
          />
          <div className="grid grid-cols-2 gap-3 border-t pt-3">
            <div className="space-y-2">
              <Label htmlFor={`${id}-hours`}>{t("hours")}</Label>
              <DocSelect
                id={`${id}-hours`}
                disabled={!date}
                value={date ? format(date, "HH") : "00"}
                options={Array.from({ length: 24 }, (_, hour) => ({
                  value: String(hour).padStart(2, "0"),
                  label: String(hour).padStart(2, "0"),
                }))}
                onChange={(next) => setTime("hours", next)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-minutes`}>{t("minutes")}</Label>
              <DocSelect
                id={`${id}-minutes`}
                disabled={!date}
                value={date ? format(date, "mm") : "00"}
                options={Array.from({ length: 60 }, (_, minute) => ({
                  value: String(minute).padStart(2, "0"),
                  label: String(minute).padStart(2, "0"),
                }))}
                onChange={(next) => setTime("minutes", next)}
              />
            </div>
          </div>
          <Button
            type="button"
            className="w-full"
            onClick={() => setOpen(false)}
          >
            {t("done")}
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  )
}
