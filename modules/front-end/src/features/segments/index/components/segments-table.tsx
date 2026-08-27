import { Copy, Loader2, MoreHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
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
import { SegmentTypeCell } from "../../components/segment-type-cell"
import type { Segment } from "../../segments-types"

type Props = {
  items: Segment[]
  loading: boolean
  archived: boolean
  lang: Lang
  query: string
  mutatingId: string | null
  canArchive: (segment: Segment) => boolean
  canRestore: (segment: Segment) => boolean
  canRemove: (segment: Segment) => boolean
  onCopy: (key: string) => void
  onArchive: (segment: Segment) => void
  onRestore: (segment: Segment) => void
  onRemove: (segment: Segment) => void
  onClearSearch: () => void
  onCreate: () => void
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

function TagsCell({ tags }: { tags: string[] }) {
  if (!tags.length) return <span className="text-muted-foreground">-</span>

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <Tooltip key={tag}>
          <TooltipTrigger
            render={
              <Badge
                variant="outline"
                className="max-w-32 rounded-full font-normal"
              />
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

export function SegmentsTable({
  items,
  loading,
  archived,
  lang,
  query,
  mutatingId,
  canArchive,
  canRestore,
  canRemove,
  onCopy,
  onArchive,
  onRestore,
  onRemove,
  onClearSearch,
  onCreate,
}: Props) {
  const { t } = useTranslation()

  return (
    <Table className="min-w-[900px] table-fixed">
      <TableHeader className="border-b text-left text-foreground">
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[25%] px-5 py-4 font-semibold">
            {t("segments.columns.segment")}
          </TableHead>
          <TableHead className="w-[19%] px-5 py-4 font-semibold">
            {t("segments.columns.type")}
          </TableHead>
          <TableHead className="w-[25%] px-5 py-4 font-semibold">
            {t("segments.columns.tags")}
          </TableHead>
          <TableHead className="w-[18%] px-5 py-4 font-semibold">
            {t("segments.columns.updated")}
          </TableHead>
          <TableHead className="w-[13%] px-5 py-4 font-semibold">
            {t("segments.columns.actions")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          Array.from({ length: 5 }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: 5 }).map((__, columnIndex) => (
                <TableCell key={columnIndex} className="px-5 py-2.5">
                  <Skeleton className="h-4 w-3/4" />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="p-0">
              <div className="flex min-h-64 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                <p className="text-sm font-medium text-foreground">
                  {query
                    ? t("segments.filteredEmpty", { query })
                    : archived
                      ? t("segments.archivedEmpty")
                      : t("segments.empty")}
                </p>
                {!query ? (
                  <p className="text-sm text-muted-foreground">
                    {t(
                      archived
                        ? "segments.archivedEmptyHelper"
                        : "segments.emptyHelper"
                    )}
                  </p>
                ) : null}
                {query ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2"
                    onClick={onClearSearch}
                  >
                    {t("segments.clearSearch")}
                  </Button>
                ) : !archived ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2"
                    onClick={onCreate}
                  >
                    {t("segments.new")}
                  </Button>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ) : (
          items.map((segment) => {
            const pending = mutatingId === segment.id
            const detailsHref = localizedPath(
              lang,
              `/segments/${encodeURIComponent(segment.id)}/targeting`
            )
            return (
              <TableRow key={segment.id}>
                <TableCell className="px-5 py-2 align-middle">
                  <div className="min-w-0 space-y-1">
                    <Link
                      to={detailsHref}
                      className="block truncate font-semibold text-foreground hover:underline"
                    >
                      {segment.name}
                    </Link>
                    <div className="flex min-w-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={t("segments.copyKey", { key: segment.key })}
                        className="flex min-w-0 items-center gap-1.5 rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        onClick={() => onCopy(segment.key)}
                      >
                        <span className="truncate">{segment.key}</span>
                        <Copy className="size-3 shrink-0" />
                      </button>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-5 py-2 align-middle">
                  <SegmentTypeCell
                    type={segment.type}
                    scopes={segment.scopes}
                  />
                </TableCell>
                <TableCell className="px-5 py-2 align-middle">
                  <TagsCell tags={segment.tags ?? []} />
                </TableCell>
                <TableCell className="px-5 py-2 align-middle whitespace-nowrap text-muted-foreground">
                  {formatDate(segment.updatedAt, lang, true)}
                </TableCell>
                <TableCell className="px-5 py-2 align-middle">
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <Link
                      to={detailsHref}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "sm" }),
                        "font-medium"
                      )}
                    >
                      {t("segments.details")}
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("segments.moreActions", {
                              name: segment.name,
                            })}
                          />
                        }
                      >
                        {pending ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <MoreHorizontal />
                        )}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-24">
                        {archived ? (
                          <>
                            <DropdownMenuItem
                              disabled={pending || !canRestore(segment)}
                              className="cursor-pointer"
                              title={
                                !canRestore(segment)
                                  ? t("segments.permissionDenied")
                                  : undefined
                              }
                              onClick={() => onRestore(segment)}
                            >
                              {t("segments.restore")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={pending || !canRemove(segment)}
                              className="cursor-pointer text-destructive data-[highlighted]:text-destructive"
                              title={
                                !canRemove(segment)
                                  ? t("segments.permissionDenied")
                                  : undefined
                              }
                              onClick={() => onRemove(segment)}
                            >
                              {t("segments.remove")}
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem
                            disabled={pending || !canArchive(segment)}
                            className="cursor-pointer"
                            title={
                              !canArchive(segment)
                                ? t("segments.permissionDenied")
                                : undefined
                            }
                            onClick={() => onArchive(segment)}
                          >
                            {t("segments.archive")}
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
