import { useQuery } from "@tanstack/react-query"
import { Copy, ExternalLink, Maximize2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SegmentTypeCell } from "@/features/segments/components/segment-type-cell"
import { fetchEndUserFlags, fetchEndUserSegments } from "../end-users-api"
import type { EndUser, EndUserFlag } from "../end-users-types"
import {
  NumberedPagination,
  SearchInput,
  TableMessage,
  TableSkeleton,
} from "./shared"
import { cn } from "@/lib/utils"

const FLAG_PAGE_SIZE = 5
const DOT_COLORS = [
  "bg-emerald-600",
  "bg-sky-600",
  "bg-amber-500",
  "bg-violet-600",
  "bg-zinc-500",
]

export function EvaluateSheet({
  envId,
  user,
  lang,
  onOpenChange,
}: {
  envId: string
  user: EndUser | null
  lang: "en" | "zh"
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [tab, setTab] = useState("flags")
  const [flagSearch, setFlagSearch] = useState("")
  const [debouncedFlagSearch, setDebouncedFlagSearch] = useState("")
  const [segmentSearch, setSegmentSearch] = useState("")
  const [flagPage, setFlagPage] = useState(1)
  const [expandedFlag, setExpandedFlag] = useState<EndUserFlag | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedFlagSearch(flagSearch.trim())
      setFlagPage(1)
    }, 400)
    return () => window.clearTimeout(timeout)
  }, [flagSearch])

  const flagsQuery = useQuery({
    queryKey: [
      "end-users",
      envId,
      user?.id,
      "flags",
      debouncedFlagSearch,
      flagPage,
    ],
    queryFn: () =>
      fetchEndUserFlags(envId, user!.id, {
        searchText: debouncedFlagSearch,
        pageIndex: flagPage - 1,
        pageSize: FLAG_PAGE_SIZE,
      }),
    enabled: Boolean(user && envId),
  })
  const segmentsQuery = useQuery({
    queryKey: ["end-users", envId, user?.id, "segments"],
    queryFn: () => fetchEndUserSegments(envId, user!.id),
    enabled: Boolean(user && envId),
  })
  const filteredSegments = useMemo(() => {
    const filter = segmentSearch.trim().toLowerCase()
    return (segmentsQuery.data ?? []).filter((segment) =>
      segment.name.toLowerCase().includes(filter)
    )
  }, [segmentSearch, segmentsQuery.data])

  function copy(value: string) {
    void navigator.clipboard.writeText(value)
    toast.success(t("endUsers.copied"))
  }

  return (
    <>
      <Sheet open={Boolean(user)} onOpenChange={onOpenChange}>
        <SheetContent className="gap-0 p-0 data-[side=right]:w-[min(100vw,960px)] data-[side=right]:sm:max-w-[960px]">
          <SheetHeader className="border-b px-6 py-5 pr-12">
            <SheetTitle>{t("endUsers.evaluate")}</SheetTitle>
            <SheetDescription className="flex items-center gap-2">
              <span className="truncate">
                {user?.name || t("endUsers.unnamed")}
              </span>
              <span>·</span>
              <span className="truncate font-mono">{user?.keyId}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7"
                onClick={() => user?.keyId && copy(user.keyId)}
              >
                <Copy className="size-3.5" />
              </Button>
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList variant="line">
                <TabsTrigger value="flags">
                  {t("endUsers.evaluateDrawer.flags")}
                </TabsTrigger>
                <TabsTrigger value="segments">
                  {t("endUsers.evaluateDrawer.segments")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="flags">
                <SearchInput
                  value={flagSearch}
                  placeholder={t("endUsers.evaluateDrawer.filterFlags")}
                  className="my-4"
                  onChange={setFlagSearch}
                />
                <div className="overflow-hidden rounded-md border">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="px-5 py-4 font-semibold">
                          {t("endUsers.name")}
                        </TableHead>
                        <TableHead className="px-5 py-4 font-semibold">
                          Key
                        </TableHead>
                        <TableHead className="px-5 py-4 font-semibold">
                          {t("endUsers.evaluateDrawer.variation")}
                        </TableHead>
                        <TableHead className="px-5 py-4 font-semibold">
                          {t("endUsers.actions")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {flagsQuery.isLoading ? (
                        <TableSkeleton columns={4} rows={5} />
                      ) : flagsQuery.isError ? (
                        <TableMessage
                          columns={4}
                          title={t("endUsers.loadFailed")}
                          action={
                            <Button
                              variant="outline"
                              onClick={() => void flagsQuery.refetch()}
                            >
                              {t("endUsers.retry")}
                            </Button>
                          }
                        />
                      ) : !(flagsQuery.data?.items.length ?? 0) ? (
                        <TableMessage
                          columns={4}
                          title={t("endUsers.evaluateDrawer.noFlags")}
                        />
                      ) : (
                        flagsQuery.data!.items.map((flag) => {
                          const variationIndex = Math.max(
                            0,
                            flag.variations.findIndex(
                              (item) => item.value === flag.matchVariation
                            )
                          )
                          const expandable = ["json", "string"].includes(
                            flag.variationType
                          )
                          return (
                            <TableRow key={flag.key}>
                              <TableCell className="truncate px-5 py-4">
                                {flag.name}
                              </TableCell>
                              <TableCell className="px-5 py-4">
                                <span className="flex min-w-0 items-center gap-2">
                                  <span className="truncate font-mono text-xs">
                                    {flag.key}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="size-7 shrink-0"
                                    onClick={() => copy(flag.key)}
                                  >
                                    <Copy className="size-3.5" />
                                  </Button>
                                </span>
                              </TableCell>
                              <TableCell className="px-5 py-4">
                                <span className="flex min-w-0 items-center gap-2">
                                  <span
                                    className={cn(
                                      "size-2 shrink-0 rounded-full",
                                      DOT_COLORS[
                                        variationIndex % DOT_COLORS.length
                                      ]
                                    )}
                                  />
                                  <span className="truncate rounded-md border bg-muted/40 px-2 py-1 text-xs">
                                    {flag.matchVariation || "—"}
                                  </span>
                                  {expandable ? (
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      className="size-7 shrink-0"
                                      aria-label={t(
                                        "endUsers.evaluateDrawer.expand"
                                      )}
                                      onClick={() => setExpandedFlag(flag)}
                                    >
                                      <Maximize2 className="size-3.5" />
                                    </Button>
                                  ) : null}
                                </span>
                              </TableCell>
                              <TableCell className="px-5 py-4">
                                <Button
                                  type="button"
                                  variant="link"
                                  className="h-auto p-0"
                                  onClick={() =>
                                    window.open(
                                      `/${lang}/feature-flags/${encodeURIComponent(flag.key)}/targeting`,
                                      "_blank"
                                    )
                                  }
                                >
                                  {t("endUsers.details")}
                                  <ExternalLink className="size-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                {flagsQuery.data?.totalCount ? (
                  <NumberedPagination
                    page={flagPage}
                    pageSize={FLAG_PAGE_SIZE}
                    total={flagsQuery.data.totalCount}
                    summary={(from, to, total) =>
                      t("endUsers.evaluateDrawer.showing", { from, to, total })
                    }
                    onPageChange={setFlagPage}
                  />
                ) : null}
              </TabsContent>
              <TabsContent value="segments">
                <SearchInput
                  value={segmentSearch}
                  placeholder={t("endUsers.evaluateDrawer.filterSegments")}
                  className="my-4"
                  onChange={setSegmentSearch}
                />
                <div className="overflow-hidden rounded-md border">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="px-5 py-4 font-semibold">
                          {t("endUsers.name")}
                        </TableHead>
                        <TableHead className="px-5 py-4 font-semibold">
                          {t("endUsers.evaluateDrawer.type")}
                        </TableHead>
                        <TableHead className="px-5 py-4 font-semibold">
                          {t("endUsers.evaluateDrawer.lastUpdated")}
                        </TableHead>
                        <TableHead className="px-5 py-4 font-semibold">
                          {t("endUsers.actions")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {segmentsQuery.isLoading ? (
                        <TableSkeleton columns={4} rows={5} />
                      ) : segmentsQuery.isError ? (
                        <TableMessage
                          columns={4}
                          title={t("endUsers.loadFailed")}
                          action={
                            <Button
                              variant="outline"
                              onClick={() => void segmentsQuery.refetch()}
                            >
                              {t("endUsers.retry")}
                            </Button>
                          }
                        />
                      ) : filteredSegments.length ? (
                        filteredSegments.map((segment) => (
                          <TableRow key={segment.id}>
                            <TableCell className="truncate px-5 py-4">
                              {segment.name}
                            </TableCell>
                            <TableCell className="px-5 py-4">
                              <SegmentTypeCell
                                type={segment.type}
                                scopes={segment.scopes}
                              />
                            </TableCell>
                            <TableCell className="truncate px-5 py-4">
                              {new Intl.DateTimeFormat(
                                lang === "zh" ? "zh-CN" : "en-US",
                                { dateStyle: "medium", timeStyle: "short" }
                              ).format(new Date(segment.updatedAt))}
                            </TableCell>
                            <TableCell className="px-5 py-4">
                              <Button
                                variant="link"
                                className="h-auto p-0"
                                onClick={() =>
                                  window.open(
                                    `/${lang}/segments/${encodeURIComponent(segment.id)}/targeting`,
                                    "_blank"
                                  )
                                }
                              >
                                {t("endUsers.details")}
                                <ExternalLink className="size-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableMessage
                          columns={4}
                          title={t("endUsers.evaluateDrawer.noSegments")}
                        />
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>
      {expandedFlag ? (
        <VariationDialog
          key={`${expandedFlag.key}-${expandedFlag.matchVariation}`}
          flag={expandedFlag}
          onOpenChange={(open) => !open && setExpandedFlag(null)}
        />
      ) : null}
    </>
  )
}

function VariationDialog({
  flag,
  onOpenChange,
}: {
  flag: EndUserFlag
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [formatted, setFormatted] = useState(flag.matchVariation)

  function format() {
    if (flag.variationType !== "json") return
    try {
      setFormatted(JSON.stringify(JSON.parse(formatted), null, 2))
    } catch {
      // Keep invalid JSON visible so the user can inspect the stored value.
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-[760px]">
        <DialogHeader className="border-b px-6 py-5 pr-12">
          <DialogTitle>
            {t("endUsers.evaluateDrawer.variationTitle")}
          </DialogTitle>
        </DialogHeader>
        <pre className="m-6 max-h-[55vh] overflow-auto rounded-md bg-zinc-950 p-4 text-sm whitespace-pre-wrap text-zinc-50">
          {formatted}
        </pre>
        <DialogFooter className="mx-0 mb-0 justify-between border-t-0 bg-transparent px-6 sm:justify-between">
          <Button type="button" variant="outline" onClick={format}>
            {t("endUsers.evaluateDrawer.format")}
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t("endUsers.evaluateDrawer.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
