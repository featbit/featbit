import { ChevronsUpDown, Pencil, X } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type SelectedResourceItem = {
  name: string
  rn: string
}

export function SelectedResourceField({
  items,
  heading,
  manageLabel,
  editText,
  emptyContent,
  editLabel,
  removeLabel,
  onEdit,
  onRemove,
  disabled,
  invalid,
}: {
  items: readonly SelectedResourceItem[]
  heading: ReactNode
  manageLabel: ReactNode
  editText: ReactNode
  emptyContent: ReactNode
  editLabel: (item: SelectedResourceItem) => string
  removeLabel: (item: SelectedResourceItem) => string
  onEdit: (item: SelectedResourceItem) => void
  onRemove: (item: SelectedResourceItem) => void
  disabled?: boolean
  invalid?: boolean
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-background",
        invalid && "border-destructive"
      )}
    >
      <div className="flex min-h-9 items-center justify-between gap-3 border-b px-3 py-1.5">
        <span className="min-w-0 truncate text-xs font-medium text-foreground">
          {heading}
        </span>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 gap-1.5 px-2 text-xs"
              disabled={disabled}
            >
              {manageLabel}
              <ChevronsUpDown className="size-3.5" />
            </Button>
          }
        />
      </div>

      {items.length ? (
        <div className="max-h-36 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] overflow-y-auto px-2 py-1.5 [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
          <div className="space-y-1">
            {items.map((item) => (
              <div
                key={item.rn}
                className="grid min-h-9 grid-cols-[minmax(4.5rem,0.35fr)_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md border bg-background px-2 py-0.5 transition-colors focus-within:bg-muted/40 hover:bg-muted/40"
              >
                <span className="min-w-0 truncate text-sm font-medium text-foreground">
                  {item.name}
                </span>
                <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                  {item.rn}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={editLabel(item)}
                  className="text-xs"
                  disabled={disabled}
                  onClick={() => onEdit(item)}
                >
                  <Pencil className="size-3.5" />
                  {editText}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label={removeLabel(item)}
                  className="text-muted-foreground hover:text-foreground"
                  disabled={disabled}
                  onClick={() => onRemove(item)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="px-3 py-2.5 text-xs text-muted-foreground">
          {emptyContent}
        </p>
      )}
    </div>
  )
}
