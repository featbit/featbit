import { Star, X } from "lucide-react"
import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
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
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  fetchGroupOptions,
  fetchPolicyOptions,
  type GroupOption,
  type PolicyOption,
} from "../team-api"

const loadPolicyOptions = (query: string) =>
  fetchPolicyOptions({ name: query }).then((result) => result.items)

const loadGroupOptions = (query: string) =>
  fetchGroupOptions({ name: query }).then((result) => result.items)

export function PolicyMultiPicker({
  selected,
  onSelectedChange,
}: {
  selected: PolicyOption[]
  onSelectedChange: (options: PolicyOption[]) => void
}) {
  const { t } = useTranslation()
  return (
    <PermissionMultiPicker
      label={t("iam.team.add.policies")}
      selectedLabel={t("iam.team.add.selectedPolicies")}
      placeholder={t("iam.team.add.searchPolicies")}
      emptyType={t("iam.team.add.policies")}
      selected={selected}
      onSelectedChange={onSelectedChange}
      getOptionMeta={(item) =>
        item.type === "SysManaged" ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3" />
            {t("iam.team.add.system")}
          </span>
        ) : null
      }
      loadOptions={loadPolicyOptions}
    />
  )
}

export function GroupMultiPicker({
  selected,
  onSelectedChange,
}: {
  selected: GroupOption[]
  onSelectedChange: (options: GroupOption[]) => void
}) {
  const { t } = useTranslation()
  return (
    <PermissionMultiPicker
      label={t("iam.team.add.groups")}
      selectedLabel={t("iam.team.add.selectedGroups")}
      placeholder={t("iam.team.add.searchGroups")}
      emptyType={t("iam.team.add.groups")}
      selected={selected}
      onSelectedChange={onSelectedChange}
      loadOptions={loadGroupOptions}
    />
  )
}

function PermissionMultiPicker<TOption extends { id: string; name: string }>({
  label,
  selectedLabel,
  placeholder,
  emptyType,
  selected,
  onSelectedChange,
  loadOptions,
  getOptionMeta,
}: {
  label: string
  selectedLabel: string
  placeholder: string
  emptyType: string
  selected: TOption[]
  onSelectedChange: (options: TOption[]) => void
  loadOptions: (query: string) => Promise<TOption[]>
  getOptionMeta?: (option: TOption) => ReactNode
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const [options, setOptions] = useState<TOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const timeout = window.setTimeout(() => {
      setLoading(true)
      loadOptions(query)
        .then((items) => {
          if (!cancelled) setOptions(items)
        })
        .catch(() => {
          if (!cancelled) setOptions([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [loadOptions, query])

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return options
    return options.filter((option) =>
      option.name.toLocaleLowerCase().includes(normalizedQuery)
    )
  }, [options, query])

  function toggleOption(option: TOption) {
    const exists = selected.some((item) => item.id === option.id)
    onSelectedChange(
      exists
        ? selected.filter((item) => item.id !== option.id)
        : [...selected, option]
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-xs text-muted-foreground">
          {t("iam.team.add.selectedCount", { count: selected.length })}
        </span>
      </div>
      <Command
        shouldFilter={false}
        className="rounded-none p-0 [&_[data-slot=command-input-wrapper]]:p-0"
      >
        <div className="px-2 py-2">
          <CommandInput
            value={query}
            placeholder={placeholder}
            onValueChange={setQuery}
          />
        </div>
        <CommandList className="max-h-40 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] overflow-y-auto border-t pt-1 [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
          {loading ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-4/5" />
            </div>
          ) : (
            <>
              <CommandEmpty>{t("iam.team.add.noResults")}</CommandEmpty>
              <CommandGroup className="[&_[cmdk-group-items]]:space-y-1">
                {filteredOptions.map((option) => {
                  const isSelected = selected.some(
                    (item) => item.id === option.id
                  )
                  return (
                    <CommandItem
                      key={option.id}
                      value={`${option.name} ${option.id}`}
                      data-checked={isSelected}
                      className="border border-transparent data-[checked=true]:border-primary/20 data-[checked=true]:bg-primary/10 data-[checked=true]:text-foreground data-[checked=true]:*:[svg]:text-primary"
                      onSelect={() => toggleOption(option)}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {option.name}
                      </span>
                      {getOptionMeta?.(option)}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
      <div className="space-y-2 border-t bg-muted/30 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-foreground">
            {selectedLabel}
          </span>
          {selected.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onSelectedChange([])}
            >
              {t("iam.team.add.clearAll")}
            </Button>
          ) : null}
        </div>
        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((option) => (
              <Badge
                key={option.id}
                variant="outline"
                className="max-w-full gap-1 rounded-full border-primary/30 bg-primary/10 py-0.5 pr-1 pl-2 font-normal text-primary"
              >
                <span className="min-w-0 truncate">{option.name}</span>
                <button
                  type="button"
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                  onClick={() =>
                    onSelectedChange(
                      selected.filter((item) => item.id !== option.id)
                    )
                  }
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("iam.team.add.noneSelected", { type: emptyType })}
          </p>
        )}
      </div>
    </div>
  )
}
