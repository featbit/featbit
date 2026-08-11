import { Plus, X } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
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
import type { SegmentUserProperty } from "@/features/segments/segments-types"

type PresetValue = SegmentUserProperty["presetValues"][number]

function valueKey(value: string) {
  return value.toLocaleLowerCase()
}

export function MultiValuePicker({
  values,
  presetValues,
  presetOnly,
  disabled,
  onChange,
}: {
  values: string[]
  presetValues: PresetValue[]
  presetOnly: boolean
  disabled: boolean
  onChange: (values: string[]) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [initialValues] = useState(values)

  const catalog = useMemo(() => {
    const presets = new Map(
      presetValues.map((preset) => [valueKey(preset.value), preset])
    )
    initialValues.forEach((value) => {
      const key = valueKey(value)
      if (!presets.has(key)) {
        presets.set(key, { id: "", value, description: value })
      }
    })
    return [...presets.values()]
  }, [initialValues, presetValues])
  const labels = new Map(
    catalog.map((preset) => [valueKey(preset.value), preset.description])
  )
  const selectedKeys = new Set(values.map(valueKey))
  const query = search.trim()
  const normalizedQuery = valueKey(query)
  const availableValues = catalog.filter(
    (preset) =>
      !selectedKeys.has(valueKey(preset.value)) &&
      (!normalizedQuery ||
        valueKey(preset.value).includes(normalizedQuery) ||
        valueKey(preset.description).includes(normalizedQuery))
  )
  const canCreate = Boolean(
    !presetOnly &&
    query &&
    !selectedKeys.has(normalizedQuery) &&
    !catalog.some((preset) => valueKey(preset.value) === normalizedQuery)
  )

  function addValue(value: string) {
    if (!value || selectedKeys.has(valueKey(value))) return
    onChange([...values, value])
    setSearch("")
    setOpen(false)
  }

  return (
    <div className="flex min-h-8 min-w-0 flex-wrap items-center gap-1 rounded-md border border-input px-2 py-0.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      {values.map((value) => {
        const label = labels.get(valueKey(value)) ?? value
        return (
          <span
            key={value}
            className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs"
          >
            <span className="truncate">{label}</span>
            <button
              type="button"
              disabled={disabled}
              aria-label={t("targeting.rules.removeValue", { value: label })}
              className="shrink-0 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() =>
                onChange(values.filter((candidate) => candidate !== value))
              }
            >
              <X className="size-3" />
            </button>
          </span>
        )
      })}
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) setSearch("")
        }}
      >
        <PopoverTrigger
          render={
            <Button
              type="button"
              role="combobox"
              variant="ghost"
              disabled={disabled}
              aria-label={t("targeting.rules.selectValues")}
              aria-expanded={open}
              className="h-6 min-w-28 flex-1 justify-start px-1 font-normal text-muted-foreground"
            />
          }
        >
          <Plus className="size-4" />
          {t("targeting.rules.selectValues")}
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--anchor-width)] min-w-72 p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              autoFocus
              placeholder={t("targeting.rules.searchValues")}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>{t("targeting.rules.noValues")}</CommandEmpty>
              {availableValues.length ? (
                <CommandGroup>
                  {availableValues.map((preset) => (
                    <CommandItem
                      key={`${preset.id}-${preset.value}`}
                      value={preset.value}
                      onSelect={() => addValue(preset.value)}
                    >
                      <span className="truncate">{preset.description}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {canCreate ? (
                <CommandGroup>
                  <CommandItem value={query} onSelect={() => addValue(query)}>
                    <Plus className="size-4" />
                    <span className="truncate">
                      {t("targeting.rules.addValue", { value: query })}
                    </span>
                  </CommandItem>
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
