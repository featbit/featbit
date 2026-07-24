import { useQuery } from "@tanstack/react-query"
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  Loader2,
  Search,
  X,
} from "lucide-react"
import { Fragment, useEffect, useMemo, useState } from "react"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  fetchSegmentAuditLogs,
  fetchSegmentTeamMembers,
} from "../../segments-api"
import type {
  AuditInstruction,
  AuditLog,
  Segment,
  SegmentTeamMember,
} from "../../segments-types"
import { ChangeLedger } from "../components/change-ledger"
import {
  auditEventKind,
  auditFragments,
  segmentSnapshot,
  settingsReviewChanges,
  targetingChanges,
  type ReviewChange,
} from "../segment-details-utils"
import { RawDataDialog } from "./raw-data-dialog"

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function dayAfter(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1
  ).getTime()
}

function memberLabel(member: SegmentTeamMember) {
  return member.name?.trim() || member.email || member.id
}

function instructionValue(value: unknown) {
  if (typeof value === "string") return value || "—"
  if (Array.isArray(value)) return value.map(String).join(", ") || "—"
  try {
    return JSON.stringify(value)
  } catch {
    return "—"
  }
}

function eventTitle(log: AuditLog, t: ReturnType<typeof useTranslation>["t"]) {
  const operation = log.operation.toLowerCase()
  if (operation === "create")
    return t("segments.detailsPage.history.events.created")
  if (operation === "archive")
    return t("segments.detailsPage.history.events.archived")
  if (operation === "restore")
    return t("segments.detailsPage.history.events.restored")
  if (operation === "remove")
    return t("segments.detailsPage.history.events.removed")
  if (operation === "update") {
    return t(
      `segments.detailsPage.history.events.${auditEventKind(log.instructions)}`
    )
  }
  return t("segments.detailsPage.history.events.unknown", {
    operation: log.operation,
  })
}

function instructionText(
  instruction: AuditInstruction,
  t: ReturnType<typeof useTranslation>["t"]
) {
  return t(`segments.detailsPage.history.instructions.${instruction.kind}`, {
    count: Array.isArray(instruction.value) ? instruction.value.length : 1,
    defaultValue: instruction.kind,
  })
}

function instructionAction(kind: string): ReviewChange["action"] {
  if (kind.startsWith("Add")) return "added"
  if (kind.startsWith("Remove")) return "removed"
  return "updated"
}

function historyChanges(
  log: AuditLog,
  t: ReturnType<typeof useTranslation>["t"]
): ReviewChange[] {
  const previous = segmentSnapshot(log.dataChange.previous)
  const current = segmentSnapshot(log.dataChange.current)
  if (previous && current) {
    const semantic = [
      ...targetingChanges(previous, current),
      ...settingsReviewChanges(previous, current),
    ]
    if (semantic.length) return semantic
  }

  return log.instructions.map((instruction) => {
    const value = instructionValue(instruction.value)
    return {
      kind: instruction.kind.includes("Rule") ? "ruleSummary" : "generic",
      label: instructionText(instruction, t),
      literalLabel: true,
      action: instructionAction(instruction.kind),
      current: value,
    }
  })
}

export function HistoryTab({
  envId,
  segment,
}: {
  envId: string
  segment: Segment
}) {
  const { t, i18n } = useTranslation()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [memberOpen, setMemberOpen] = useState(false)
  const [memberSearch, setMemberSearch] = useState("")
  const [debouncedMemberSearch, setDebouncedMemberSearch] = useState("")
  const [member, setMember] = useState<SegmentTeamMember | null>(null)
  const [dateOpen, setDateOpen] = useState(false)
  const [range, setRange] = useState<DateRange | undefined>()
  const [draftRange, setDraftRange] = useState<DateRange | undefined>()
  const [pageSize, setPageSize] = useState(10)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [rawData, setRawData] = useState<AuditLog | null>(null)

  const toggleExpanded = (logId: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(logId)) next.delete(logId)
      else next.add(logId)
      return next
    })
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPageSize(10)
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedMemberSearch(memberSearch.trim()),
      300
    )
    return () => window.clearTimeout(timeout)
  }, [memberSearch])

  const membersQuery = useQuery({
    queryKey: ["segment-history-members", debouncedMemberSearch],
    queryFn: () =>
      fetchSegmentTeamMembers({ searchText: debouncedMemberSearch }),
    enabled: memberOpen,
    staleTime: 30_000,
  })
  const logsQuery = useQuery({
    queryKey: [
      "segment-audit-logs",
      envId,
      segment.id,
      debouncedSearch,
      member?.id,
      range?.from?.toISOString(),
      range?.to?.toISOString(),
      pageSize,
    ],
    queryFn: () =>
      fetchSegmentAuditLogs(envId, {
        segmentId: segment.id,
        crossEnvironment: segment.type === "shared",
        query: debouncedSearch,
        creatorId: member?.id,
        from: range?.from ? dayStart(range.from) : undefined,
        to: range?.to ? dayAfter(range.to) : undefined,
        pageIndex: 0,
        pageSize,
      }),
  })

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [i18n.language]
  )
  const dayFormatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }),
    [i18n.language]
  )
  const rangeLabel =
    range?.from && range.to
      ? `${dayFormatter.format(range.from)} – ${dayFormatter.format(range.to)}`
      : t("segments.detailsPage.history.anyDate")
  const items = logsQuery.data?.items ?? []

  function renderFragment(log: AuditLog) {
    const fragments = auditFragments(log.instructions)
    if (!fragments.length) return null
    const visible = fragments.slice(0, 2).map((fragment) =>
      t(`segments.detailsPage.history.fragments.${fragment.kind}`, {
        count: fragment.count,
        defaultValue: `${fragment.kind} ${fragment.count}`,
      })
    )
    if (fragments.length > 2) {
      visible.push(
        t("segments.detailsPage.history.moreFragments", {
          count: fragments.length - 2,
        })
      )
    }
    return visible.join(" · ")
  }

  return (
    <div className="space-y-5 py-5">
      <div className="flex items-center gap-4">
        <div className="relative w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            className="pl-9"
            placeholder={t("segments.detailsPage.history.search")}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="flex items-center gap-1">
          <Popover open={memberOpen} onOpenChange={setMemberOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={memberOpen}
                  className="w-64 justify-between font-normal"
                />
              }
            >
              <span className="truncate">
                {member
                  ? memberLabel(member)
                  : t("segments.detailsPage.history.allUsers")}
              </span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-0">
              <Command shouldFilter={false}>
                <CommandInput
                  value={memberSearch}
                  placeholder={t("segments.detailsPage.history.memberSearch")}
                  onValueChange={setMemberSearch}
                />
                <CommandList>
                  {membersQuery.isLoading ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      {t("segments.detailsPage.loading")}
                    </div>
                  ) : membersQuery.isError ? (
                    <div className="flex items-center justify-between px-3 py-4 text-sm text-destructive">
                      {t("segments.detailsPage.history.memberLoadFailed")}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void membersQuery.refetch()}
                      >
                        {t("segments.retry")}
                      </Button>
                    </div>
                  ) : null}
                  <CommandEmpty>
                    {t("segments.detailsPage.history.noMembers")}
                  </CommandEmpty>
                  <CommandGroup>
                    {(membersQuery.data?.items ?? []).map((option) => (
                      <CommandItem
                        key={option.id}
                        value={option.id}
                        onSelect={() => {
                          setMember(option)
                          setMemberOpen(false)
                          setPageSize(10)
                        }}
                      >
                        <Check
                          className={
                            member?.id === option.id
                              ? "size-4 opacity-100"
                              : "size-4 opacity-0"
                          }
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm">
                            {memberLabel(option)}
                          </p>
                          {option.email && option.name ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {option.email}
                            </p>
                          ) : null}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {member ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={t("segments.detailsPage.history.clearMember")}
              onClick={() => {
                setMember(null)
                setPageSize(10)
              }}
            >
              <X />
            </Button>
          ) : null}
        </div>

        <Popover
          open={dateOpen}
          onOpenChange={(open) => {
            setDateOpen(open)
            if (open) setDraftRange(range)
            else setDraftRange(range)
          }}
        >
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                className="w-64 justify-start font-normal"
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
                ? t("segments.detailsPage.history.selectEndDate")
                : ""}
            </p>
            <div className="flex justify-end gap-2 px-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRange(undefined)
                  setDraftRange(undefined)
                  setDateOpen(false)
                  setPageSize(10)
                }}
              >
                {t("segments.detailsPage.history.clear")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraftRange(range)
                  setDateOpen(false)
                }}
              >
                {t("segments.confirm.cancel")}
              </Button>
              <Button
                type="button"
                disabled={!draftRange?.from || !draftRange.to}
                onClick={() => {
                  setRange(draftRange)
                  setDateOpen(false)
                  setPageSize(10)
                }}
              >
                {t("segments.detailsPage.history.apply")}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {segment.type === "shared" ? (
          <div className="ml-auto flex items-center gap-2 text-sm text-primary">
            {t("segments.detailsPage.history.acrossScopes", {
              count: segment.scopes.length,
            })}
            <Tooltip>
              <TooltipTrigger render={<Info className="size-4" />} />
              <TooltipContent>
                {t("segments.detailsPage.history.acrossScopesHelp")}
              </TooltipContent>
            </Tooltip>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-md border">
        {logsQuery.isError ? (
          <div className="flex items-center justify-between bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {t("segments.detailsPage.history.loadFailed")}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void logsQuery.refetch()}
            >
              {t("segments.retry")}
            </Button>
          </div>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12" />
              <TableHead>
                {t("segments.detailsPage.history.columns.date")}
              </TableHead>
              <TableHead>
                {t("segments.detailsPage.history.columns.user")}
              </TableHead>
              <TableHead>
                {t("segments.detailsPage.history.columns.event")}
              </TableHead>
              <TableHead>
                {t("segments.detailsPage.history.columns.comment")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logsQuery.isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-40 text-center text-muted-foreground"
                >
                  <Loader2 className="mx-auto size-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : items.length ? (
              items.map((log) => {
                const isExpanded = expanded.has(log.id)
                const creator =
                  log.creatorName ||
                  log.creatorEmail ||
                  log.creatorId ||
                  t("segments.detailsPage.history.system")
                const fragment = renderFragment(log)
                const changes = historyChanges(log, t)
                const comment = log.comment?.trim()
                const hasRawData = Boolean(
                  log.dataChange.previous || log.dataChange.current
                )
                return (
                  <Fragment key={log.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleExpanded(log.id)}
                    >
                      <TableCell>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-expanded={isExpanded}
                          aria-label={
                            isExpanded
                              ? t("segments.detailsPage.history.collapse")
                              : t("segments.detailsPage.history.expand")
                          }
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleExpanded(log.id)
                          }}
                        >
                          {isExpanded ? <ChevronDown /> : <ChevronRight />}
                        </Button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {dateFormatter.format(new Date(log.createdAt))}
                      </TableCell>
                      <TableCell className="max-w-56">
                        <p className="truncate">{creator}</p>
                        {log.creatorEmail && log.creatorName ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {log.creatorEmail}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-80">
                        <p className="truncate">{eventTitle(log, t)}</p>
                        {fragment ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {fragment}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-80">
                        {comment ? (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <span className="inline-block max-w-full truncate align-middle text-sm" />
                              }
                            >
                              {comment}
                            </TooltipTrigger>
                            <TooltipContent>{comment}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={5}
                          className="p-3 whitespace-normal"
                        >
                          <div className="rounded-md bg-muted/40 p-4">
                            <div className="mb-3 flex items-center justify-between">
                              <div className="flex items-baseline gap-2">
                                <h3 className="text-sm font-medium">
                                  {t("segments.detailsPage.history.changes")}
                                </h3>
                                <span className="text-sm text-muted-foreground">
                                  {t(
                                    "segments.detailsPage.review.changeCount",
                                    {
                                      count: changes.length,
                                    }
                                  )}
                                </span>
                              </div>
                              {hasRawData ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="leading-none"
                                  onClick={() => setRawData(log)}
                                >
                                  <span className="relative top-px">
                                    {t(
                                      "segments.detailsPage.history.viewRawData"
                                    )}
                                  </span>
                                </Button>
                              ) : null}
                            </div>
                            {changes.length ? (
                              <ChangeLedger
                                changes={changes}
                                layout="history"
                                className="max-h-[32rem] bg-transparent p-0"
                              />
                            ) : (
                              <p className="py-5 text-center text-sm text-muted-foreground">
                                {t(
                                  "segments.detailsPage.history.noSemanticChanges"
                                )}
                              </p>
                            )}
                            <div className="mt-4 border-t pt-3">
                              <p className="text-xs font-medium text-muted-foreground">
                                {t(
                                  "segments.detailsPage.history.columns.comment"
                                )}
                              </p>
                              <p
                                className={
                                  comment
                                    ? "mt-1 text-sm break-words whitespace-pre-wrap"
                                    : "mt-1 text-sm text-muted-foreground"
                                }
                              >
                                {comment || "—"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                )
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-40 text-center text-muted-foreground"
                >
                  {t("segments.detailsPage.history.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {(logsQuery.data?.totalCount ?? 0) > items.length ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={logsQuery.isFetching}
            onClick={() => setPageSize((current) => current + 10)}
          >
            {logsQuery.isFetching ? <Loader2 className="animate-spin" /> : null}
            {t("segments.detailsPage.history.loadMore")}
          </Button>
        </div>
      ) : null}

      <RawDataDialog
        auditLog={rawData}
        onOpenChange={(open) => !open && setRawData(null)}
      />
    </div>
  )
}
