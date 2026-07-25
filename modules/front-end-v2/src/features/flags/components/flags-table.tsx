import { Copy, Loader2, MoreHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
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
import { localizedPath } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import { cn } from "@/lib/utils"
import { Link } from "react-router-dom"
import { flagsCopy } from "../flags-copy"
import type { FeatureFlag } from "../flags-types"

type Props = {
  lang: Lang
  items: FeatureFlag[]
  loading: boolean
  archived: boolean
  hasFilters: boolean
  selectedIds: Set<string>
  mutatingId: string | null
  canToggle: (flag: FeatureFlag) => boolean
  canArchive: (flag: FeatureFlag) => boolean
  canRestore: (flag: FeatureFlag) => boolean
  canRemove: (flag: FeatureFlag) => boolean
  onToggleSelected: (flag: FeatureFlag) => void
  onTogglePage: () => void
  onToggle: (flag: FeatureFlag) => void
  onCopyKey: (key: string) => void
  onCopyTo: (flag: FeatureFlag) => void
  onClone: (flag: FeatureFlag) => void
  onCompare: (flag: FeatureFlag) => void
  onArchive: (flag: FeatureFlag) => void
  onRestore: (flag: FeatureFlag) => void
  onRemove: (flag: FeatureFlag) => void
  onClearFilters: () => void
  onCreate: () => void
  canCreate: boolean
}

function personName(person?: { name?: string; email?: string }) {
  return person?.name || person?.email || ""
}

function formatDate(value: string, lang: Lang, withTime = false) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(date)
}

const variationDotColors = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-fuchsia-500",
  "bg-lime-500",
  "bg-orange-500",
]

function TagsCell({ tags }: { tags: string[] }) {
  if (!tags.length) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <Tooltip key={tag}>
          <TooltipTrigger
            render={
              <Badge variant="outline" className="max-w-28 font-normal" />
            }
          >
            <span className="truncate">{tag}</span>
          </TooltipTrigger>
          <TooltipContent>{tag}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

function ServingCell({
  flag,
  lang,
  pending,
  allowed,
  onToggle,
}: {
  flag: FeatureFlag
  lang: Lang
  pending: boolean
  allowed: boolean
  onToggle: () => void
}) {
  const c = flagsCopy(lang)
  const enabledValues = flag.serves?.enabledVariations ?? []
  const displayed = flag.isEnabled
    ? enabledValues.length > 1
      ? c.variations(enabledValues.length)
      : enabledValues[0] || "—"
    : flag.serves?.disabledVariation || "—"
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Switch
          checked={flag.isEnabled}
          disabled={pending || !allowed}
          onCheckedChange={onToggle}
        />
        <span className="text-xs font-medium">
          {flag.isEnabled ? c.on : c.off}
        </span>
        <Badge variant="outline" className="font-normal text-muted-foreground">
          {flag.variationType.toUpperCase()}
        </Badge>
        {pending ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        ) : null}
      </div>
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="inline-flex max-w-52 items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs" />
          }
        >
          <span className="shrink-0 text-muted-foreground">{c.serving}:</span>
          <span className="flex shrink-0 items-center -space-x-0.5">
            {flag.isEnabled && enabledValues.length ? (
              enabledValues.map((value, index) => (
                <span
                  key={`${value}-${index}`}
                  className={cn(
                    "size-2 rounded-full ring-1 ring-background",
                    variationDotColors[index % variationDotColors.length]
                  )}
                />
              ))
            ) : (
              <span className="size-2 rounded-full bg-muted-foreground/60" />
            )}
          </span>
          <span className="min-w-0 truncate font-medium">{displayed}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-80 p-2">
          <div className="space-y-1.5">
            {flag.isEnabled && enabledValues.length ? (
              enabledValues.map((value, index) => (
                <div
                  key={`${value}-${index}`}
                  className="flex min-w-0 items-start gap-2"
                >
                  <span
                    className={cn(
                      "mt-1 size-2 shrink-0 rounded-full",
                      variationDotColors[index % variationDotColors.length]
                    )}
                  />
                  <span className="min-w-0 font-mono text-xs break-all whitespace-pre-wrap">
                    {value}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex min-w-0 items-start gap-2">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-muted-foreground/60" />
                <span className="min-w-0 font-mono text-xs break-all whitespace-pre-wrap">
                  {displayed}
                </span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

export function FlagsTable(props: Props) {
  const c = flagsCopy(props.lang)
  const pageSelected =
    props.items.length > 0 &&
    props.items.every((flag) => props.selectedIds.has(flag.id))
  const pagePartlySelected =
    !pageSelected && props.items.some((flag) => props.selectedIds.has(flag.id))
  return (
    <Table className="min-w-[1180px] table-fixed">
      <TableHeader className="border-b text-left text-foreground">
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-14 px-5 py-4">
            <Checkbox
              checked={pageSelected}
              indeterminate={pagePartlySelected}
              onCheckedChange={props.onTogglePage}
            />
          </TableHead>
          <TableHead className="w-[28%] px-5 py-4 font-semibold">
            {c.name}
          </TableHead>
          <TableHead className="w-[20%] px-5 py-4 font-semibold">
            {c.statusServing}
          </TableHead>
          <TableHead className="w-[20%] px-5 py-4 font-semibold">
            {c.tags}
          </TableHead>
          <TableHead className="w-[20%] px-5 py-4 font-semibold">
            {c.lastChange}
          </TableHead>
          <TableHead className="w-[12%] px-5 py-4 font-semibold">
            {c.actions}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.loading ? (
          Array.from({ length: 5 }).map((_, row) => (
            <TableRow key={row}>
              {Array.from({ length: 6 }).map((__, column) => (
                <TableCell key={column} className="px-5 py-5">
                  <Skeleton className="h-4 w-3/4" />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : props.items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="p-0">
              <div className="flex min-h-64 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                <p className="text-sm font-medium">
                  {props.hasFilters
                    ? c.filteredEmpty
                    : props.archived
                      ? c.archivedEmpty
                      : c.empty}
                </p>
                <p className="max-w-md text-sm text-muted-foreground">
                  {props.hasFilters
                    ? ""
                    : props.archived
                      ? c.archivedEmptyHelper
                      : c.emptyHelper}
                </p>
                {props.hasFilters ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2"
                    onClick={props.onClearFilters}
                  >
                    {c.clearFilters}
                  </Button>
                ) : props.canCreate && !props.archived ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2"
                    onClick={props.onCreate}
                  >
                    {c.newFlag}
                  </Button>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ) : (
          props.items.map((flag) => {
            const selected = props.selectedIds.has(flag.id)
            const pending = props.mutatingId === flag.id
            const detailsHref = localizedPath(
              props.lang,
              `/feature-flags/${encodeURIComponent(flag.key)}/targeting`
            )
            return (
              <TableRow
                key={flag.id}
                data-state={selected ? "selected" : undefined}
                className="data-[state=selected]:bg-muted/40"
              >
                <TableCell className="px-5 py-4">
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => props.onToggleSelected(flag)}
                  />
                </TableCell>
                <TableCell className="px-5 py-4">
                  <div className="min-w-0 space-y-1.5">
                    <Link
                      to={detailsHref}
                      className="block truncate font-semibold text-foreground hover:underline"
                    >
                      {flag.name}
                    </Link>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            aria-label={c.copyKey(flag.key)}
                            className="inline-flex max-w-full items-center gap-1.5 rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            onClick={() => props.onCopyKey(flag.key)}
                          />
                        }
                      >
                        <span className="truncate">{flag.key}</span>
                        <Copy className="size-3 shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent>{flag.key}</TooltipContent>
                    </Tooltip>
                    {personName(flag.creator) ? (
                      <p className="flex min-w-0 items-center gap-1.5 text-xs">
                        <span className="shrink-0 text-muted-foreground">
                          {c.createdBy}
                        </span>
                        <span className="truncate font-medium text-foreground">
                          {personName(flag.creator)}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          · {formatDate(flag.createdAt, props.lang)}
                        </span>
                      </p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="px-5 py-4">
                  <ServingCell
                    flag={flag}
                    lang={props.lang}
                    pending={pending}
                    allowed={props.canToggle(flag)}
                    onToggle={() => props.onToggle(flag)}
                  />
                </TableCell>
                <TableCell className="px-5 py-4">
                  <TagsCell tags={flag.tags ?? []} />
                </TableCell>
                <TableCell className="px-5 py-4">
                  <div className="max-w-full min-w-0 space-y-1.5 text-sm">
                    {flag.lastChange ? (
                      <>
                        <p>
                          {formatDate(
                            flag.lastChange.happenedAt,
                            props.lang,
                            true
                          )}
                        </p>
                        {personName(flag.lastChange.operator) ? (
                          <p className="flex min-w-0 items-center gap-1.5 text-xs">
                            <span className="shrink-0 text-muted-foreground">
                              {c.updatedBy}
                            </span>
                            <span className="truncate font-medium text-foreground">
                              {personName(flag.lastChange.operator)}
                            </span>
                          </p>
                        ) : null}
                        {flag.lastChange.comment ? (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <p className="block max-w-52 truncate text-xs text-muted-foreground" />
                              }
                            >
                              {flag.lastChange.comment}
                            </TooltipTrigger>
                            <TooltipContent className="max-w-80 whitespace-normal">
                              {flag.lastChange.comment}
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-muted-foreground">{c.noChanges}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="px-5 py-4">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <Link
                      to={detailsHref}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "sm" }),
                        "font-medium"
                      )}
                    >
                      {c.details}
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label={c.moreActions(flag.name)}
                          />
                        }
                      >
                        {pending ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <MoreHorizontal />
                        )}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-48">
                        <DropdownMenuItem onClick={() => props.onCopyTo(flag)}>
                          {c.copyTo}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => props.onClone(flag)}>
                          {c.clone}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => props.onCompare(flag)}>
                          {c.compare}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {props.archived ? (
                          <>
                            <DropdownMenuItem
                              disabled={pending || !props.canRestore(flag)}
                              title={
                                !props.canRestore(flag)
                                  ? c.permissionDenied
                                  : undefined
                              }
                              onClick={() => props.onRestore(flag)}
                            >
                              {c.restore}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={pending || !props.canRemove(flag)}
                              className="text-destructive data-[highlighted]:text-destructive"
                              title={
                                !props.canRemove(flag)
                                  ? c.permissionDenied
                                  : undefined
                              }
                              onClick={() => props.onRemove(flag)}
                            >
                              {c.remove}
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem
                            disabled={pending || !props.canArchive(flag)}
                            title={
                              !props.canArchive(flag)
                                ? c.permissionDenied
                                : undefined
                            }
                            onClick={() => props.onArchive(flag)}
                          >
                            {c.archive}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}
