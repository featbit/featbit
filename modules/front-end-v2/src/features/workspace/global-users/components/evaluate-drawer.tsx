import { Copy } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  fetchEndUserFlags,
  fetchEndUserSegments,
  type EndUserFlag,
  type EndUserSegment,
  type GlobalUser,
  type PagedResult,
} from "../global-users-api"
import { Pagination } from "./pagination"
import { ActionLink, SearchBox, SimpleTable } from "./shared"

export function EvaluateDrawer({
  user,
  lang,
  onClose,
  onCopied,
}: {
  user: GlobalUser | null
  lang: "en" | "zh"
  onClose: () => void
  onCopied: () => void
}) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<"flags" | "segments">("flags")
  const [flagSearch, setFlagSearch] = useState("")
  const [debouncedFlagSearch, setDebouncedFlagSearch] = useState("")
  const [flagPage, setFlagPage] = useState(1)
  const [flags, setFlags] = useState<PagedResult<EndUserFlag>>({
    totalCount: 0,
    items: [],
  })
  const [segments, setSegments] = useState<EndUserSegment[]>([])
  const [segmentSearch, setSegmentSearch] = useState("")
  const flagsRequestKey = user
    ? `${user.id}:${debouncedFlagSearch}:${flagPage}`
    : ""
  const segmentsRequestKey = user?.id ?? ""
  const [loadedFlagsRequestKey, setLoadedFlagsRequestKey] = useState("")
  const [loadedSegmentsRequestKey, setLoadedSegmentsRequestKey] = useState("")
  const isFlagsLoading = Boolean(
    user && flagsRequestKey !== loadedFlagsRequestKey
  )
  const isSegmentsLoading = Boolean(
    user && segmentsRequestKey !== loadedSegmentsRequestKey
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedFlagSearch(flagSearch)
      setFlagPage(1)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [flagSearch])

  useEffect(() => {
    if (!user) {
      return
    }

    let cancelled = false
    fetchEndUserFlags(user.id, {
      searchText: debouncedFlagSearch,
      pageIndex: flagPage - 1,
      pageSize: 10,
    })
      .then((result) => {
        if (!cancelled) {
          setFlags(result)
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setLoadedFlagsRequestKey(flagsRequestKey)
        }
      })

    return () => {
      cancelled = true
    }
  }, [debouncedFlagSearch, flagPage, flagsRequestKey, user])

  useEffect(() => {
    if (!user) {
      return
    }

    let cancelled = false
    fetchEndUserSegments(user.id)
      .then((result) => {
        if (!cancelled) {
          setSegments(result)
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setLoadedSegmentsRequestKey(segmentsRequestKey)
        }
      })

    return () => {
      cancelled = true
    }
  }, [segmentsRequestKey, user])

  const filteredSegments = segments.filter((segment) =>
    segment.name.toLowerCase().includes(segmentSearch.trim().toLowerCase())
  )

  return (
    <Sheet
      open={Boolean(user)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose()
        }
      }}
    >
      <SheetContent className="gap-0 p-0 data-[side=right]:w-[min(100vw,960px)] data-[side=right]:sm:max-w-[960px]">
        <SheetHeader className="border-b px-6 py-5 pr-12">
          <SheetTitle className="truncate">
            {user?.name || t("workspace.globalUsers.unnamedUser")}
          </SheetTitle>
          <SheetDescription className="inline-flex min-w-0 items-center gap-2">
            <span className="truncate font-mono">{user?.keyId}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => {
                if (!user?.keyId) {
                  return
                }
                void navigator.clipboard.writeText(user.keyId)
                onCopied()
              }}
            >
              <Copy className="size-3.5" />
            </Button>
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as "flags" | "segments")}
          >
            <TabsList variant="line">
              <TabsTrigger value="flags">
                {t("workspace.globalUsers.evaluate.flags")}
              </TabsTrigger>
              <TabsTrigger value="segments">
                {t("workspace.globalUsers.evaluate.segments")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="flags">
              <FlagsPanel
                flags={flags}
                isLoading={isFlagsLoading}
                lang={lang}
                search={flagSearch}
                page={flagPage}
                onCopied={onCopied}
                onPageChange={setFlagPage}
                onSearchChange={setFlagSearch}
              />
            </TabsContent>
            <TabsContent value="segments">
              <SegmentsPanel
                segments={filteredSegments}
                isLoading={isSegmentsLoading}
                lang={lang}
                search={segmentSearch}
                onSearchChange={setSegmentSearch}
              />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function FlagsPanel({
  flags,
  isLoading,
  lang,
  search,
  page,
  onCopied,
  onPageChange,
  onSearchChange,
}: {
  flags: PagedResult<EndUserFlag>
  isLoading: boolean
  lang: "en" | "zh"
  search: string
  page: number
  onCopied: () => void
  onPageChange: (page: number) => void
  onSearchChange: (value: string) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="pt-4">
      <SearchBox
        value={search}
        placeholder={t("workspace.globalUsers.evaluate.filterFlags")}
        className="mb-4 max-w-sm"
        onChange={onSearchChange}
      />
      <SimpleTable
        columns={[
          t("workspace.globalUsers.name"),
          "Key",
          t("workspace.globalUsers.evaluate.variation"),
          t("workspace.globalUsers.actions"),
        ]}
        loading={isLoading}
        rows={flags.items.map((flag) => [
          flag.name,
          <span
            key="key"
            className="inline-flex min-w-0 items-center gap-2 font-mono"
          >
            <span className="truncate">{flag.key}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => {
                void navigator.clipboard.writeText(flag.key)
                onCopied()
              }}
            >
              <Copy className="size-3.5" />
            </Button>
          </span>,
          <span
            key="variation"
            className="inline-flex max-w-[14rem] items-center gap-2"
          >
            <span className="size-2 rounded-full bg-primary" />
            <span className="truncate rounded-md bg-muted px-2 py-1 text-xs">
              {flag.matchVariation || "-"}
            </span>
          </span>,
          <ActionLink
            key="details"
            onClick={() =>
              window.open(
                `/${lang}/feature-flags/${encodeURIComponent(flag.key)}/targeting`,
                "_blank"
              )
            }
          >
            {t("workspace.globalUsers.detailsAction")}
          </ActionLink>,
        ])}
      />
      <Pagination
        pageIndex={page}
        pageSize={10}
        totalCount={flags.totalCount}
        showSummary={false}
        onPageIndexChange={onPageChange}
        onPageSizeChange={() => undefined}
      />
    </div>
  )
}

function SegmentsPanel({
  segments,
  isLoading,
  lang,
  search,
  onSearchChange,
}: {
  segments: EndUserSegment[]
  isLoading: boolean
  lang: "en" | "zh"
  search: string
  onSearchChange: (value: string) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="pt-4">
      <SearchBox
        value={search}
        placeholder={t("workspace.globalUsers.evaluate.filterSegments")}
        className="mb-4 max-w-sm"
        onChange={onSearchChange}
      />
      <SimpleTable
        columns={[
          t("workspace.globalUsers.name"),
          t("workspace.globalUsers.evaluate.type"),
          t("workspace.globalUsers.evaluate.lastUpdated"),
          t("workspace.globalUsers.actions"),
        ]}
        loading={isLoading}
        rows={segments.map((segment) => [
          segment.name,
          segment.type,
          new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(segment.updatedAt)),
          <ActionLink
            key="details"
            onClick={() =>
              window.open(
                `/${lang}/segments/details/${encodeURIComponent(segment.id)}/targeting`,
                "_blank"
              )
            }
          >
            {t("workspace.globalUsers.detailsAction")}
          </ActionLink>,
        ])}
      />
    </div>
  )
}
