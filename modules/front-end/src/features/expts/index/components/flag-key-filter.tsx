import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown, LoaderCircle, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
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
import { fetchFeatureFlags } from "@/features/flags/flags-api"
import { cn } from "@/lib/utils"
import { matchesFlagKey } from "./flag-key-filter-utils"

const FLAG_OPTION_PAGE_SIZE = 20

export function FlagKeyFilter({
  envId,
  value,
  onChange,
}: {
  envId: string
  value: string
  onChange: (flagKey: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      350
    )
    return () => window.clearTimeout(timeout)
  }, [search])

  const flagsQuery = useQuery({
    queryKey: ["experiment-flag-key-options", envId, debouncedSearch],
    queryFn: () =>
      fetchFeatureFlags(envId, {
        name: debouncedSearch,
        tags: [],
        isArchived: false,
        sortBy: "key",
        pageIndex: 1,
        pageSize: FLAG_OPTION_PAGE_SIZE,
      }),
    enabled: Boolean(open && envId),
    staleTime: 30_000,
  })

  const options = useMemo(
    () =>
      (flagsQuery.data?.items ?? []).filter((flag) =>
        matchesFlagKey(flag, debouncedSearch)
      ),
    [debouncedSearch, flagsQuery.data?.items]
  )

  return (
    <div className="flex h-8 w-60 overflow-hidden rounded-lg border border-input bg-background">
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) {
            setSearch("")
            setDebouncedSearch("")
          }
        }}
      >
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              disabled={!envId}
              className="h-full min-w-0 flex-1 justify-between rounded-none px-2.5 font-normal hover:bg-accent"
            />
          }
        >
          <span
            className={cn(
              "min-w-0 truncate font-mono",
              !value && "font-sans text-muted-foreground"
            )}
          >
            {value || t("releaseDecision.experiments.flagFilter")}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0">
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder={t("releaseDecision.experiments.flagSearch")}
            />
            <CommandList>
              {flagsQuery.isFetching ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  {t("releaseDecision.experiments.flagLoading")}
                </div>
              ) : null}
              {flagsQuery.isError ? (
                <div className="py-6 text-center text-sm text-destructive">
                  {t("releaseDecision.experiments.flagLoadFailed")}
                </div>
              ) : null}
              {!flagsQuery.isFetching && !flagsQuery.isError ? (
                <CommandEmpty>
                  {t("releaseDecision.experiments.flagEmpty")}
                </CommandEmpty>
              ) : null}
              <CommandGroup>
                {options.map((flag) => (
                  <CommandItem
                    key={flag.id}
                    value={flag.key}
                    onSelect={() => {
                      onChange(flag.key)
                      setOpen(false)
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{flag.name}</span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        {flag.key}
                      </span>
                    </span>
                    <Check
                      className={cn(
                        "size-4 text-primary",
                        value === flag.key ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-full rounded-none border-l"
          aria-label={t("releaseDecision.experiments.clearFlagFilter")}
          onClick={() => onChange("")}
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>
  )
}
