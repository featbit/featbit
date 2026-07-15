import type { Key, ReactNode, Ref } from "react"
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

type SelectableCommandListProps<TItem> = {
  items: readonly TItem[]
  getKey: (item: TItem) => Key
  getValue: (item: TItem) => string
  isSelected: (item: TItem) => boolean
  onSelect: (item: TItem) => void
  renderItem: (item: TItem) => ReactNode
  emptyContent: ReactNode
  groupHeading?: ReactNode
  isDisabled?: (item: TItem) => boolean
  loading?: boolean
  loadingContent?: ReactNode
  afterItems?: ReactNode
  listClassName?: string
  listRef?: Ref<HTMLDivElement>
}

export function SelectableCommandList<TItem>({
  items,
  getKey,
  getValue,
  isSelected,
  onSelect,
  renderItem,
  emptyContent,
  groupHeading,
  isDisabled,
  loading = false,
  loadingContent,
  afterItems,
  listClassName,
  listRef,
}: SelectableCommandListProps<TItem>) {
  return (
    <CommandList ref={listRef} className={listClassName}>
      {loading ? (
        loadingContent
      ) : (
        <>
          <CommandEmpty>{emptyContent}</CommandEmpty>
          <CommandGroup
            heading={groupHeading}
            className="[&_[cmdk-group-items]]:space-y-1"
          >
            {items.map((item) => (
              <CommandItem
                key={getKey(item)}
                value={getValue(item)}
                disabled={isDisabled?.(item)}
                data-checked={isSelected(item)}
                className="data-[checked=true]:bg-accent data-[checked=true]:text-accent-foreground data-[checked=true]:*:[svg]:text-foreground"
                onSelect={() => onSelect(item)}
              >
                {renderItem(item)}
              </CommandItem>
            ))}
          </CommandGroup>
          {afterItems}
        </>
      )}
    </CommandList>
  )
}
