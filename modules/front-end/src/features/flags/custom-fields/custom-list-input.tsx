import { Check, ChevronsUpDown, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useDocumentationCopy } from "../documentation/use-documentation-copy"

export function CustomListInput({
  id,
  options,
  value,
  disabled,
  invalid,
  onChange,
  onBlur,
}: {
  id: string
  options: string[]
  value: string[]
  disabled: boolean
  invalid: boolean
  onChange: (value: string[]) => void
  onBlur: () => void
}) {
  const { t } = useDocumentationCopy()
  const toggle = (option: string) =>
    onChange(
      value.includes(option)
        ? value.filter((item) => item !== option)
        : [...value, option]
    )
  return (
    <div className="space-y-2">
      <Popover
        onOpenChange={(open) => {
          if (!open) onBlur()
        }}
      >
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              aria-invalid={invalid}
              className="w-full justify-between font-normal"
            />
          }
        >
          {value.length
            ? t("listSelected", { count: value.length })
            : t("selectListOptions")}
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command>
            <CommandInput placeholder={t("searchListOptions")} />
            <CommandList>
              <CommandEmpty>{t("noListOptions")}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    data-checked={value.includes(option)}
                    onSelect={() => toggle(option)}
                  >
                    <Check
                      className={
                        value.includes(option) ? "size-4" : "size-4 opacity-0"
                      }
                    />
                    {option}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length ? (
        <div className="flex flex-wrap gap-2">
          {value.map((option) => (
            <Badge key={option} variant="secondary" className="gap-1">
              {option}
              <button
                type="button"
                disabled={disabled}
                aria-label={t("removeListOption", { option })}
                className="rounded-sm p-0.5 hover:bg-muted disabled:opacity-50"
                onClick={() => toggle(option)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}
