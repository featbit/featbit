import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { useQuery } from "@tanstack/react-query"
import { Loader2, Plus, X } from "lucide-react"
import { type ReactNode, useMemo, useState } from "react"
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
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import { fetchFeatureFlagTags } from "../../flags-api"

function FlagTagPopoverContent({ children }: { children: ReactNode }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align="start"
        side="bottom"
        sideOffset={4}
        className="isolate z-[60]"
      >
        <PopoverPrimitive.Popup className="w-(--anchor-width) min-w-72 rounded-md border bg-popover text-popover-foreground shadow-md outline-none">
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

export function FlagTagPicker({
  envId,
  tags,
  disabled,
  onChange,
  onOpenChange,
}: {
  envId: string
  tags: string[]
  disabled: boolean
  onChange: (tags: string[]) => void
  onOpenChange?: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [createdTags, setCreatedTags] = useState<string[]>([])
  const tagsQuery = useQuery({
    queryKey: ["feature-flag-tags", envId],
    queryFn: () => fetchFeatureFlagTags(envId),
    enabled: Boolean(envId),
    staleTime: 5 * 60_000,
  })

  const catalog = useMemo(
    () => Array.from(new Set([...(tagsQuery.data ?? []), ...createdTags])),
    [createdTags, tagsQuery.data]
  )
  const query = search.trim()
  const normalizedQuery = query.toLocaleLowerCase()
  const availableTags = catalog.filter(
    (tag) =>
      !tags.includes(tag) &&
      (!normalizedQuery || tag.toLocaleLowerCase().includes(normalizedQuery))
  )
  const canCreate = Boolean(
    query &&
    !catalog.some((tag) => tag.toLocaleLowerCase() === normalizedQuery) &&
    !tags.some((tag) => tag.toLocaleLowerCase() === normalizedQuery)
  )

  function addTag(tag: string, created = false) {
    if (!tag || tags.includes(tag)) return
    if (created) {
      setCreatedTags((current) =>
        current.includes(tag) ? current : [...current, tag]
      )
    }
    onChange([...tags, tag])
    setSearch("")
    setOpen(false)
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-2 rounded-md border px-3 py-1 focus-within:ring-2 focus-within:ring-ring/30">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs"
        >
          {tag}
          <button
            type="button"
            disabled={disabled}
            aria-label={t("featureFlags.removeTag", { tag })}
            onClick={() => onChange(tags.filter((item) => item !== tag))}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          onOpenChange?.(nextOpen)
          if (!nextOpen) setSearch("")
        }}
      >
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              className="h-7 min-w-48 flex-1 justify-start px-1 font-normal text-muted-foreground"
            />
          }
        >
          <Plus className="size-4" />
          {t("featureFlags.tagPlaceholder")}
        </PopoverTrigger>
        <FlagTagPopoverContent>
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              placeholder={t("featureFlags.tagPlaceholder")}
              onValueChange={setSearch}
            />
            <CommandList>
              {tagsQuery.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t("featureFlags.loading")}
                </div>
              ) : null}
              {tagsQuery.isError && !tagsQuery.data ? (
                <div className="flex items-center justify-between gap-3 px-3 py-4 text-sm text-destructive">
                  <span>{t("featureFlags.tagsLoadFailed")}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void tagsQuery.refetch()}
                  >
                    {t("featureFlags.retry")}
                  </Button>
                </div>
              ) : null}
              {!tagsQuery.isLoading ? (
                <CommandEmpty>{t("featureFlags.noTags")}</CommandEmpty>
              ) : null}
              {availableTags.length ? (
                <CommandGroup heading={t("featureFlags.availableTags")}>
                  {availableTags.map((tag) => (
                    <CommandItem
                      key={tag}
                      value={tag}
                      onSelect={() => addTag(tag)}
                    >
                      {tag}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {canCreate ? (
                <CommandGroup>
                  <CommandItem
                    value={query}
                    onSelect={() => addTag(query, true)}
                  >
                    <Plus className="size-4" />
                    {t("featureFlags.createTag", { tag: query })}
                  </CommandItem>
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </FlagTagPopoverContent>
      </Popover>
    </div>
  )
}
