import type { ReactNode } from "react"
import { ChevronRight, Loader2, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function SelectionList({
  search,
  setSearch,
  searchPlaceholder,
  emptyText,
  children,
}: {
  search: string
  setSearch: (value: string) => void
  searchPlaceholder: string
  emptyText: string
  children: ReactNode
}) {
  const isEmpty = Array.isArray(children) && children.length === 0

  return (
    <div className="mt-6">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-10 pl-9"
          value={search}
          placeholder={searchPlaceholder}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="mt-3 max-h-[22rem] overflow-y-auto rounded-lg border">
        {isEmpty ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

export function SelectionItem({
  icon,
  title,
  subtitle,
  loading,
  disabled,
  onClick,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  loading?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent",
        disabled && "pointer-events-none cursor-default opacity-50"
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {title}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {subtitle}
        </span>
      </span>
      {loading ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : (
        <ChevronRight className="size-4 text-muted-foreground" />
      )}
    </button>
  )
}
