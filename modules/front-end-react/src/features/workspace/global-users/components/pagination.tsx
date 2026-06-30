import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [10, 20, 30];

export function Pagination({
  pageIndex,
  pageSize,
  totalCount,
  showSummary = true,
  onPageIndexChange,
  onPageSizeChange
}: {
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  showSummary?: boolean;
  onPageIndexChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const first = totalCount === 0 ? 0 : (pageIndex - 1) * pageSize + 1;
  const last = Math.min(totalCount, pageIndex * pageSize);
  const pages = Array.from(new Set([1, pageIndex - 1, pageIndex, pageIndex + 1, totalPages]))
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-3 py-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
      {showSummary ? <div>{t("workspace.globalUsers.pagination.summary", { first, last, total: totalCount })}</div> : <div />}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" disabled={pageIndex <= 1} onClick={() => onPageIndexChange(pageIndex - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((page, index) => {
          const previous = pages[index - 1];
          return (
            <span key={page} className="flex items-center gap-2">
              {previous && page - previous > 1 ? <span className="px-2 text-foreground">...</span> : null}
              <Button
                variant={page === pageIndex ? "outline" : "ghost"}
                size="icon"
                className={cn(page === pageIndex && "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400")}
                onClick={() => onPageIndexChange(page)}
              >
                {page}
              </Button>
            </span>
          );
        })}
        <Button variant="outline" size="icon" disabled={pageIndex >= totalPages} onClick={() => onPageIndexChange(pageIndex + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-0 h-9 min-w-28 justify-between md:ml-4">
              {t("workspace.globalUsers.pagination.pageSize", { size: pageSize })}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {PAGE_SIZES.map((size) => (
              <DropdownMenuItem key={size} onSelect={() => onPageSizeChange(size)}>
                {t("workspace.globalUsers.pagination.pageSize", { size })}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
