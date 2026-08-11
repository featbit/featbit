import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown, LoaderCircle, X } from "lucide-react"
import { useEffect, useState } from "react"
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
import { cn } from "@/lib/utils"
import { fetchAccessTokenCreators } from "../access-tokens-api"
import type { AccessTokenCreator } from "../access-token-types"

function creatorLabel(creator: AccessTokenCreator) {
  return creator.name?.trim() || creator.email?.trim() || creator.id
}

export function CreatorFilter({
  value,
  onChange,
}: {
  value: AccessTokenCreator | null
  onChange: (creator: AccessTokenCreator | null) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 500)
    return () => window.clearTimeout(timeout)
  }, [search])

  const creatorsQuery = useQuery({
    queryKey: ["access-token-creators", debouncedSearch],
    queryFn: () => fetchAccessTokenCreators(debouncedSearch),
    enabled: open,
    staleTime: 30_000,
  })

  return (
    <div className="flex h-8 overflow-hidden rounded-lg border border-input bg-background">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              className="h-full w-44 justify-between rounded-none px-2.5 font-normal hover:bg-accent"
            />
          }
        >
          <span
            className={cn(
              "min-w-0 truncate",
              !value && "text-muted-foreground"
            )}
          >
            {value ? creatorLabel(value) : t("accessTokens.creator")}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder={t("accessTokens.creatorSearch")}
            />
            <CommandList>
              {creatorsQuery.isFetching ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  {t("accessTokens.loading")}
                </div>
              ) : null}
              {!creatorsQuery.isFetching ? (
                <CommandEmpty>{t("accessTokens.creatorEmpty")}</CommandEmpty>
              ) : null}
              <CommandGroup>
                {(creatorsQuery.data?.items ?? []).map((creator) => {
                  const selected = creator.id === value?.id
                  return (
                    <CommandItem
                      key={creator.id}
                      value={creator.id}
                      onSelect={() => {
                        onChange(creator)
                        setOpen(false)
                      }}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          {creatorLabel(creator)}
                        </span>
                        {creator.name && creator.email ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {creator.email}
                          </span>
                        ) : null}
                      </span>
                      <Check
                        className={cn(
                          "size-4 text-primary",
                          selected ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  )
                })}
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
          aria-label={t("accessTokens.actions.clearCreator")}
          onClick={() => onChange(null)}
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>
  )
}
