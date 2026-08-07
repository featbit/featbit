import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ChevronsUpDown, Loader2, Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
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
import { upsertEndUserProperty } from "@/features/end-users/end-users-api"
import type { SegmentUserProperty } from "@/features/segments/segments-types"
import { segmentConditionProperties } from "./segment-conditions"

function propertyKey(name: string) {
  return name.toLocaleLowerCase()
}

function appendProperty(
  properties: SegmentUserProperty[] | undefined,
  property: SegmentUserProperty
) {
  const current = properties ?? []
  return current.some(
    (item) => propertyKey(item.name) === propertyKey(property.name)
  )
    ? current
    : [...current, property]
}

export function PropertyPicker({
  envId,
  value,
  properties,
  includeSegmentConditions = false,
  disabled,
  onValueChange,
}: {
  envId: string
  value: string
  properties: SegmentUserProperty[]
  includeSegmentConditions?: boolean
  disabled: boolean
  onValueChange: (property: string) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const options = useMemo(() => {
    const catalog: Array<{ id: string; name: string }> = [
      ...(includeSegmentConditions
        ? segmentConditionProperties.map((name) => ({ id: name, name }))
        : []),
      { name: "keyId", id: "keyId" },
      { name: "name", id: "name" },
      ...properties,
    ]
    if (value) catalog.push({ name: value, id: value })

    const seen = new Set<string>()
    return catalog.filter((property) => {
      const key = propertyKey(property.name)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [includeSegmentConditions, properties, value])

  const query = search.trim()
  const normalizedQuery = propertyKey(query)
  const reservedSegmentProperty = segmentConditionProperties.some(
    (property) => propertyKey(property) === normalizedQuery
  )
  const filteredOptions = options.filter(
    (property) =>
      !normalizedQuery || propertyKey(property.name).includes(normalizedQuery)
  )
  const canCreate = Boolean(
    query &&
    (includeSegmentConditions || !reservedSegmentProperty) &&
    !options.some((property) => propertyKey(property.name) === normalizedQuery)
  )

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const id = crypto.randomUUID()
      const property: SegmentUserProperty = {
        id,
        name,
        presetValues: [],
        usePresetValuesOnly: false,
        isBuiltIn: false,
        isDigestField: false,
        remark: "",
      }
      const saved = await upsertEndUserProperty(envId, id, {
        name,
        presetValues: [],
        usePresetValuesOnly: false,
        isDigestField: false,
        remark: "",
      })
      return saved ?? property
    },
    onSuccess: (property) => {
      const cacheKeys = [
        ["flag-user-properties", envId],
        ["segment-user-properties", envId],
        ["end-users", envId, "properties"],
      ] as const
      cacheKeys.forEach((cacheKey) =>
        queryClient.setQueryData<SegmentUserProperty[]>(cacheKey, (current) =>
          appendProperty(current, property)
        )
      )
      onValueChange(property.name)
      setSearch("")
      setOpen(false)
    },
    onError: () => toast.error(t("targeting.rules.createPropertyFailed")),
  })

  function selectProperty(property: string) {
    onValueChange(property)
    setSearch("")
    setOpen(false)
  }

  return (
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
            variant="outline"
            disabled={disabled}
            aria-label={t("targeting.rules.selectProperty")}
            aria-expanded={open}
            className="w-full justify-between px-3 font-normal"
          />
        }
      >
        <span className="truncate">{value}</span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--anchor-width)] min-w-72 p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            autoFocus
            placeholder={t("targeting.rules.searchProperty")}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{t("targeting.rules.noProperties")}</CommandEmpty>
            {filteredOptions.length ? (
              <CommandGroup>
                {filteredOptions.map((property) => (
                  <CommandItem
                    key={property.id}
                    value={property.name}
                    data-checked={property.name === value}
                    onSelect={() => selectProperty(property.name)}
                  >
                    <span className="truncate">{property.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {canCreate ? (
              <CommandGroup>
                <CommandItem
                  value={`create-${query}`}
                  disabled={createMutation.isPending}
                  onSelect={() => createMutation.mutate(query)}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  <span className="truncate">
                    {t("targeting.rules.createProperty", { property: query })}
                  </span>
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
