import { Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  fetchEndUserFlags,
  fetchEndUserSegments,
  type EndUserFlag,
  type EndUserSegment,
  type GlobalUser,
  type PagedResult
} from "../global-users-api";
import { Pagination } from "./pagination";
import { ActionLink, DrawerHeader, SearchBox, SimpleTable } from "./shared";

export function EvaluateDrawer({
  user,
  lang,
  onClose,
  onCopied
}: {
  user: GlobalUser | null;
  lang: "en" | "zh";
  onClose: () => void;
  onCopied: () => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"flags" | "segments">("flags");
  const [flagSearch, setFlagSearch] = useState("");
  const [debouncedFlagSearch, setDebouncedFlagSearch] = useState("");
  const [flagPage, setFlagPage] = useState(1);
  const [flags, setFlags] = useState<PagedResult<EndUserFlag>>({ totalCount: 0, items: [] });
  const [segments, setSegments] = useState<EndUserSegment[]>([]);
  const [segmentSearch, setSegmentSearch] = useState("");
  const flagsRequestKey = user ? `${user.id}:${debouncedFlagSearch}:${flagPage}` : "";
  const segmentsRequestKey = user?.id ?? "";
  const [loadedFlagsRequestKey, setLoadedFlagsRequestKey] = useState("");
  const [loadedSegmentsRequestKey, setLoadedSegmentsRequestKey] = useState("");
  const isFlagsLoading = Boolean(user && flagsRequestKey !== loadedFlagsRequestKey);
  const isSegmentsLoading = Boolean(user && segmentsRequestKey !== loadedSegmentsRequestKey);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedFlagSearch(flagSearch);
      setFlagPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [flagSearch]);

  useEffect(() => {
    if (!user) {
      return;
    }
    let cancelled = false;
    fetchEndUserFlags(user.id, { searchText: debouncedFlagSearch, pageIndex: flagPage - 1, pageSize: 10 })
      .then((result) => {
        if (!cancelled) {
          setFlags(result);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setLoadedFlagsRequestKey(flagsRequestKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedFlagSearch, flagPage, flagsRequestKey, user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    let cancelled = false;
    fetchEndUserSegments(user.id)
      .then((result) => {
        if (!cancelled) {
          setSegments(result);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setLoadedSegmentsRequestKey(segmentsRequestKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [segmentsRequestKey, user]);

  if (!user) {
    return null;
  }

  const filteredSegments = segments.filter((segment) => segment.name.toLowerCase().includes(segmentSearch.trim().toLowerCase()));

  return (
    <div className="fixed inset-0 z-40 bg-black/10" onClick={onClose}>
      <aside className="ml-auto h-full w-full max-w-[960px] border-l border-border bg-background shadow-xl" onClick={(event) => event.stopPropagation()}>
        <DrawerHeader
          title={user.name || t("workspace.globalUsers.unnamedUser")}
          subtitle={
            <span className="inline-flex min-w-0 items-center gap-2">
              <span className="truncate font-mono">{user.keyId}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  void navigator.clipboard.writeText(user.keyId);
                  onCopied();
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </span>
          }
          onClose={onClose}
        />
        <div className="px-6 py-4">
          <div className="flex gap-8 border-b border-border">
            <EvaluateTab active={tab === "flags"} onClick={() => setTab("flags")}>
              {t("workspace.globalUsers.evaluate.flags")}
            </EvaluateTab>
            <EvaluateTab active={tab === "segments"} onClick={() => setTab("segments")}>
              {t("workspace.globalUsers.evaluate.segments")}
            </EvaluateTab>
          </div>
          {tab === "flags" ? (
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
          ) : (
            <SegmentsPanel
              segments={filteredSegments}
              isLoading={isSegmentsLoading}
              lang={lang}
              search={segmentSearch}
              onSearchChange={setSegmentSearch}
            />
          )}
        </div>
      </aside>
    </div>
  );
}

function EvaluateTab({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      className={cn(
        "relative cursor-pointer px-0 py-2.5 text-sm font-medium transition-colors after:absolute after:bottom-[-1px] after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-transparent after:content-['']",
        active
          ? "text-blue-600 after:bg-blue-600 dark:text-blue-400 dark:after:bg-blue-500"
          : "text-muted-foreground hover:text-foreground"
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function FlagsPanel({
  flags,
  isLoading,
  lang,
  search,
  page,
  onCopied,
  onPageChange,
  onSearchChange
}: {
  flags: PagedResult<EndUserFlag>;
  isLoading: boolean;
  lang: "en" | "zh";
  search: string;
  page: number;
  onCopied: () => void;
  onPageChange: (page: number) => void;
  onSearchChange: (value: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="pt-4">
      <SearchBox value={search} placeholder={t("workspace.globalUsers.evaluate.filterFlags")} className="mb-4 max-w-sm" onChange={onSearchChange} />
      <SimpleTable
        columns={[t("workspace.globalUsers.name"), "Key", t("workspace.globalUsers.evaluate.variation"), t("workspace.globalUsers.actions")]}
        loading={isLoading}
        rows={flags.items.map((flag) => [
          flag.name,
          <span key="key" className="inline-flex min-w-0 items-center gap-2 font-mono">
            <span className="truncate">{flag.key}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { void navigator.clipboard.writeText(flag.key); onCopied(); }}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </span>,
          <span key="variation" className="inline-flex max-w-[14rem] items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            <span className="truncate rounded-md bg-muted px-2 py-1 text-xs">{flag.matchVariation || "-"}</span>
          </span>,
          <ActionLink key="details" onClick={() => window.open(`/${lang}/feature-flags/${encodeURIComponent(flag.key)}/targeting`, "_blank")}>
            {t("workspace.globalUsers.detailsAction")}
          </ActionLink>
        ])}
      />
      <Pagination pageIndex={page} pageSize={10} totalCount={flags.totalCount} showSummary={false} onPageIndexChange={onPageChange} onPageSizeChange={() => undefined} />
    </div>
  );
}

function SegmentsPanel({
  segments,
  isLoading,
  lang,
  search,
  onSearchChange
}: {
  segments: EndUserSegment[];
  isLoading: boolean;
  lang: "en" | "zh";
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="pt-4">
      <SearchBox value={search} placeholder={t("workspace.globalUsers.evaluate.filterSegments")} className="mb-4 max-w-sm" onChange={onSearchChange} />
      <SimpleTable
        columns={[t("workspace.globalUsers.name"), t("workspace.globalUsers.evaluate.type"), t("workspace.globalUsers.evaluate.lastUpdated"), t("workspace.globalUsers.actions")]}
        loading={isLoading}
        rows={segments.map((segment) => [
          segment.name,
          segment.type,
          new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(segment.updatedAt)),
          <ActionLink key="details" onClick={() => window.open(`/${lang}/segments/details/${encodeURIComponent(segment.id)}/targeting`, "_blank")}>
            {t("workspace.globalUsers.detailsAction")}
          </ActionLink>
        ])}
      />
    </div>
  );
}
