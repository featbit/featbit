import {
  CustomFieldFilterChip,
  CustomFieldFilterIcon,
} from "./custom-field-filter-chip"
import { useState } from "react"
import { Plus } from "lucide-react"
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
import { useDocumentationCopy } from "../../documentation/use-documentation-copy"
import {
  filterControlKey,
  maxCustomFieldFilters,
  type CustomFieldFilter,
  type FilterControl,
} from "../../custom-fields/custom-field-filters"

export function CustomFieldFilters({
  controls,
  filters,
  onChange,
}: {
  controls: FilterControl[]
  filters: CustomFieldFilter[]
  onChange: (filters: CustomFieldFilter[]) => void
}) {
  const { t } = useDocumentationCopy()
  const [addOpen, setAddOpen] = useState(false)
  const limit = filters.length >= maxCustomFieldFilters
  const available = controls.filter(
    (control) =>
      !filters.some(
        (filter) => filterControlKey(filter) === filterControlKey(control)
      )
  )
  return (
    <>
      <Popover open={addOpen} onOpenChange={setAddOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              disabled={limit}
              title={t("filters.limit")}
            />
          }
        >
          <Plus />
          {t("filters.add")}
          {filters.length ? ` (${filters.length}/2)` : ""}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0">
          <Command>
            <CommandInput placeholder={t("filters.search")} />
            <CommandList>
              <CommandEmpty>{t("filters.empty")}</CommandEmpty>
              <CommandGroup>
                {available.map((control) => (
                  <CommandItem
                    key={filterControlKey(control)}
                    value={control.name}
                    onSelect={() => {
                      if (filters.length >= maxCustomFieldFilters) return
                      onChange([
                        ...filters,
                        {
                          fieldId: control.fieldId,
                          controlId: control.controlId,
                          type: control.type,
                        },
                      ])
                      setAddOpen(false)
                    }}
                  >
                    <CustomFieldFilterIcon type={control.type} />
                    {control.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <p className="border-t px-3 py-2 text-xs text-muted-foreground">
              {t("filters.limit")}
            </p>
          </Command>
        </PopoverContent>
      </Popover>
      {filters.map((filter) => {
        const control = controls.find(
          (item) => filterControlKey(item) === filterControlKey(filter)
        )
        return control ? (
          <CustomFieldFilterChip
            key={filterControlKey(filter)}
            control={control}
            filter={filter}
            onApply={(condition) =>
              onChange(
                filters.map((item) =>
                  filterControlKey(item) === filterControlKey(filter)
                    ? { ...item, condition }
                    : item
                )
              )
            }
            onRemove={() =>
              onChange(
                filters.filter(
                  (item) => filterControlKey(item) !== filterControlKey(filter)
                )
              )
            }
          />
        ) : null
      })}
    </>
  )
}
