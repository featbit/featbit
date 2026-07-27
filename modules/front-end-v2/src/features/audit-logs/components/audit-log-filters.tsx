import { useQuery } from "@tanstack/react-query"
import {
  CalendarDays,
  Check,
  ChevronDown,
  Loader2,
  Search,
  X,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { fetchAuditUsers } from "../audit-logs-api"
import type { AuditUser } from "../audit-logs-types"

function userLabel(user: AuditUser) {
  return user.name?.trim() || user.email || user.id
}

export function AuditLogFilters({
  locale,
  search,
  user,
  refType,
  range,
  filtersApplied,
  showRefType = true,
  onSearchChange,
  onUserChange,
  onRefTypeChange,
  onRangeChange,
  onClear,
}: {
  locale: string
  search: string
  user: AuditUser | null
  refType: string
  range: DateRange | undefined
  filtersApplied: boolean
  showRefType?: boolean
  onSearchChange: (value: string) => void
  onUserChange: (value: AuditUser | null) => void
  onRefTypeChange: (value: string) => void
  onRangeChange: (value: DateRange | undefined) => void
  onClear: () => void
}) {
  const { t } = useTranslation()
  const [userOpen, setUserOpen] = useState(false)
  const [userSearch, setUserSearch] = useState("")
  const [debouncedUserSearch, setDebouncedUserSearch] = useState("")
  const [dateOpen, setDateOpen] = useState(false)
  const [draftRange, setDraftRange] = useState<DateRange | undefined>()

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedUserSearch(userSearch.trim()),
      300
    )
    return () => window.clearTimeout(timeout)
  }, [userSearch])

  const usersQuery = useQuery({
    queryKey: ["audit-log-users", debouncedUserSearch],
    queryFn: () => fetchAuditUsers(debouncedUserSearch),
    enabled: userOpen,
    staleTime: 30_000,
  })
  const dayFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale]
  )
  const rangeLabel =
    range?.from && range.to
      ? `${dayFormatter.format(range.from)} – ${dayFormatter.format(range.to)}`
      : t("auditLogs.anyDate")

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative w-80 min-w-64">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          className="pl-9"
          placeholder={t("auditLogs.search")}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="flex items-center gap-1">
        <Popover open={userOpen} onOpenChange={setUserOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={userOpen}
                className="w-64 justify-between font-normal"
              />
            }
          >
            <span className="truncate">
              {user ? userLabel(user) : t("auditLogs.allUsers")}
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <Command shouldFilter={false}>
              <CommandInput
                value={userSearch}
                placeholder={t("auditLogs.userSearch")}
                onValueChange={setUserSearch}
              />
              <CommandList>
                {usersQuery.isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    {t("auditLogs.loading")}
                  </div>
                ) : usersQuery.isError ? (
                  <div className="flex items-center justify-between gap-3 px-3 py-4 text-sm text-destructive">
                    {t("auditLogs.usersLoadFailed")}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void usersQuery.refetch()}
                    >
                      {t("auditLogs.retry")}
                    </Button>
                  </div>
                ) : (
                  <>
                    <CommandEmpty>{t("auditLogs.noUsers")}</CommandEmpty>
                    <CommandGroup>
                      {(usersQuery.data?.items ?? []).map((option) => (
                        <CommandItem
                          key={option.id}
                          value={option.id}
                          onSelect={() => {
                            onUserChange(option)
                            setUserOpen(false)
                          }}
                        >
                          <Check
                            className={
                              user?.id === option.id
                                ? "size-4 opacity-100"
                                : "size-4 opacity-0"
                            }
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm">
                              {userLabel(option)}
                            </p>
                            {option.name && option.email ? (
                              <p className="truncate text-xs text-muted-foreground">
                                {option.email}
                              </p>
                            ) : null}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {user ? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t("auditLogs.clearUser")}
            onClick={() => onUserChange(null)}
          >
            <X />
          </Button>
        ) : null}
      </div>

      {showRefType ? (
        <Select
          value={refType || "all"}
          onValueChange={(value) =>
            onRefTypeChange(value === "all" || value === null ? "" : value)
          }
        >
          <SelectTrigger className="w-52">
            <SelectValue>
              {refType === "FeatureFlag"
                ? t("auditLogs.featureFlag")
                : refType === "Segment"
                  ? t("auditLogs.segment")
                  : t("auditLogs.allTypes")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">{t("auditLogs.allTypes")}</SelectItem>
              <SelectItem value="FeatureFlag">
                {t("auditLogs.featureFlag")}
              </SelectItem>
              <SelectItem value="Segment">{t("auditLogs.segment")}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      ) : null}

      <Popover
        open={dateOpen}
        onOpenChange={(open) => {
          setDateOpen(open)
          setDraftRange(range)
        }}
      >
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="w-56 justify-start font-normal"
              aria-label={rangeLabel}
            />
          }
        >
          <CalendarDays className="size-4" />
          <span className="truncate">{rangeLabel}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-3">
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={draftRange}
            onSelect={setDraftRange}
          />
          <p className="min-h-5 px-2 text-xs text-muted-foreground">
            {draftRange?.from && !draftRange.to
              ? t("auditLogs.selectEndDate")
              : ""}
          </p>
          <div className="flex justify-end gap-2 px-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onRangeChange(undefined)
                setDraftRange(undefined)
                setDateOpen(false)
              }}
            >
              {t("auditLogs.clear")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraftRange(range)
                setDateOpen(false)
              }}
            >
              {t("auditLogs.cancel")}
            </Button>
            <Button
              type="button"
              disabled={!draftRange?.from || !draftRange.to}
              onClick={() => {
                onRangeChange(draftRange)
                setDateOpen(false)
              }}
            >
              {t("auditLogs.apply")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="ghost"
        disabled={!filtersApplied}
        onClick={onClear}
      >
        {t("auditLogs.clearFilters")}
      </Button>
    </div>
  )
}
