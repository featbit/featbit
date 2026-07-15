import { ChevronsUpDown, X } from "lucide-react"
import type { Key, ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PopoverTrigger } from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type SelectedItemsFieldProps<TItem> = {
  items: readonly TItem[]
  getKey: (item: TItem) => Key
  getLabel: (item: TItem) => string
  getDescription?: (item: TItem) => string | undefined
  heading: ReactNode
  manageLabel: ReactNode
  emptyContent: ReactNode
  removeLabel: (item: TItem) => string
  onRemove: (item: TItem) => void
  isItemDisabled?: (item: TItem) => boolean
  disabled?: boolean
  invalid?: boolean
}

export function SelectedItemsField<TItem>({
  items,
  getKey,
  getLabel,
  getDescription,
  heading,
  manageLabel,
  emptyContent,
  removeLabel,
  onRemove,
  isItemDisabled,
  disabled,
  invalid,
}: SelectedItemsFieldProps<TItem>) {
  return (
    <TooltipProvider>
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
          <div className="max-h-28 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] overflow-y-auto p-2 [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
            <div className="flex flex-wrap gap-1.5">
              {items.map((item) => {
                const label = getLabel(item)
                const description = getDescription?.(item)
                const itemDisabled = Boolean(isItemDisabled?.(item))
                return (
                  <Badge
                    key={getKey(item)}
                    variant="secondary"
                    className={cn(
                      "max-w-full gap-1 rounded-full border-border py-0.5 pr-1 pl-2 font-normal",
                      itemDisabled && "opacity-60"
                    )}
                  >
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span className="block max-w-56 min-w-0 truncate" />
                        }
                      >
                        {label}
                      </TooltipTrigger>
                      <TooltipContent className="max-w-72">
                        <div className="min-w-0">
                          <p className="font-medium">{label}</p>
                          {description ? (
                            <p className="mt-0.5 font-mono text-[0.7rem] break-all opacity-80">
                              {description}
                            </p>
                          ) : null}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                    <button
                      type="button"
                      aria-label={removeLabel(item)}
                      className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                      disabled={disabled || itemDisabled}
                      onClick={() => onRemove(item)}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="px-3 py-2.5 text-xs text-muted-foreground">
            {emptyContent}
          </p>
        )}
      </div>
    </TooltipProvider>
  )
}
