import { useQuery } from "@tanstack/react-query"
import { Check, ChevronDown, Loader2, Search } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import {
  fetchOrganizationMembers,
  type OrganizationMember,
} from "@/features/organization/organization-members-api"
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
import type { ChangeRequestStatus } from "../change-requests-types"

function memberLabel(member: OrganizationMember) {
  return member.name?.trim() || member.email || member.id
}

function MemberFilter({
  value,
  label,
  allLabel,
  searchPlaceholder,
  onChange,
}: {
  value: OrganizationMember | null
  label: string
  allLabel: string
  searchPlaceholder: string
  onChange: (member: OrganizationMember | null) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      250
    )
    return () => window.clearTimeout(timeout)
  }, [search])

  const membersQuery = useQuery({
    queryKey: ["change-request-members", debouncedSearch],
    queryFn: () => fetchOrganizationMembers({ searchText: debouncedSearch }),
    enabled: open,
    staleTime: 30_000,
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-label={label}
            aria-expanded={open}
            className="w-52 justify-between font-normal"
          />
        }
      >
        <span className="truncate">{value ? memberLabel(value) : label}</span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            placeholder={searchPlaceholder}
            onValueChange={setSearch}
          />
          <CommandList>
            {membersQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t("changeRequests.loadingMore")}
              </div>
            ) : membersQuery.isError ? (
              <div className="flex items-center justify-between gap-3 px-3 py-4 text-sm text-destructive">
                {t("changeRequests.membersLoadFailed")}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void membersQuery.refetch()}
                >
                  {t("changeRequests.retry")}
                </Button>
              </div>
            ) : (
              <>
                <CommandEmpty>{t("changeRequests.noMembers")}</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="all"
                    onSelect={() => {
                      onChange(null)
                      setOpen(false)
                    }}
                  >
                    <Check className={value ? "size-4 opacity-0" : "size-4"} />
                    {allLabel}
                  </CommandItem>
                  {(membersQuery.data?.items ?? []).map((member) => (
                    <CommandItem
                      key={member.id}
                      value={member.id}
                      onSelect={() => {
                        onChange(member)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={
                          value?.id === member.id
                            ? "size-4 opacity-100"
                            : "size-4 opacity-0"
                        }
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm">
                          {memberLabel(member)}
                        </p>
                        {member.name && member.email ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {member.email}
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
  )
}

export function ChangeRequestFilters({
  query,
  author,
  reviewer,
  status,
  filtersApplied,
  onQueryChange,
  onAuthorChange,
  onReviewerChange,
  onStatusChange,
  onClear,
}: {
  query: string
  author: OrganizationMember | null
  reviewer: OrganizationMember | null
  status?: ChangeRequestStatus
  filtersApplied: boolean
  onQueryChange: (value: string) => void
  onAuthorChange: (member: OrganizationMember | null) => void
  onReviewerChange: (member: OrganizationMember | null) => void
  onStatusChange: (status: ChangeRequestStatus | undefined) => void
  onClear: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-80 min-w-64">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          className="pl-9"
          aria-label={t("changeRequests.filterByComment")}
          placeholder={t("changeRequests.filterByComment")}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>

      <MemberFilter
        value={author}
        label={t("changeRequests.author")}
        allLabel={t("changeRequests.allAuthors")}
        searchPlaceholder={t("changeRequests.searchAuthors")}
        onChange={onAuthorChange}
      />
      <MemberFilter
        value={reviewer}
        label={t("changeRequests.reviewer")}
        allLabel={t("changeRequests.allReviewers")}
        searchPlaceholder={t("changeRequests.searchReviewers")}
        onChange={onReviewerChange}
      />

      <Select
        value={status ?? "all"}
        onValueChange={(value) =>
          onStatusChange(
            value === "all" || value === null
              ? undefined
              : (value as ChangeRequestStatus)
          )
        }
      >
        <SelectTrigger className="w-52" aria-label={t("changeRequests.status")}>
          <SelectValue>
            {status
              ? t(`changeRequests.statuses.${status}`)
              : t("changeRequests.allStatuses")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">
              {t("changeRequests.allStatuses")}
            </SelectItem>
            {(
              [
                "PendingReview",
                "Approved",
                "Declined",
                "Applied",
              ] as ChangeRequestStatus[]
            ).map((option) => (
              <SelectItem key={option} value={option}>
                {t(`changeRequests.statuses.${option}`)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {filtersApplied ? (
        <Button type="button" variant="ghost" onClick={onClear}>
          {t("changeRequests.clearFilters")}
        </Button>
      ) : null}
    </div>
  )
}
