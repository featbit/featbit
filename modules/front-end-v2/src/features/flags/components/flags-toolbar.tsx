import {
  Archive,
  ChevronsUpDown,
  Copy,
  GitCompareArrows,
  Plus,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Lang } from "@/features/layout/layout-types"
import { flagsCopy } from "../flags-copy"

type Props = {
  lang: Lang
  search: string
  tags: string[]
  selectedTags: string[]
  tagsLoading: boolean
  status: "all" | "on" | "off"
  archived: boolean
  selectedCount: number
  canCreate: boolean
  canCopySelected: boolean
  onSearchChange: (value: string) => void
  onTagsChange: (value: string[]) => void
  onStatusChange: (value: "all" | "on" | "off") => void
  onArchivedChange: (value: boolean) => void
  onClearFilters: () => void
  onClearSelection: () => void
  onCopySelected: () => void
  onCompare: () => void
  onCreate: () => void
}

export function FlagsToolbar(props: Props) {
  const c = flagsCopy(props.lang)
  const filtersApplied = Boolean(
    props.search.trim() || props.selectedTags.length || props.status !== "all"
  )
  const visibleTags = props.selectedTags.slice(0, 2)
  const hiddenTagCount = props.selectedTags.length - visibleTags.length
  const tagLabel = props.selectedTags.length
    ? `${c.tags}: ${visibleTags.join(", ")}${hiddenTagCount ? ` +${hiddenTagCount}` : ""}`
    : `${c.tags}: ${c.any}`

  function toggleTag(tag: string) {
    props.onTagsChange(
      props.selectedTags.includes(tag)
        ? props.selectedTags.filter((item) => item !== tag)
        : [...props.selectedTags, tag]
    )
  }

  return (
    <div className="mb-5 grid gap-3 2xl:grid-cols-[1fr_auto] 2xl:items-center">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="relative w-full min-w-0 lg:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={props.search}
            className="pl-9"
            placeholder={c.search}
            onChange={(event) => props.onSearchChange(event.target.value)}
          />
        </div>
        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                className="w-52 justify-between font-normal"
              />
            }
          >
            <span className="truncate">{tagLabel}</span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-52 p-0">
            <Command>
              <CommandInput placeholder={c.tags} />
              <CommandList>
                <CommandEmpty>
                  {props.tagsLoading ? "…" : c.noTags}
                </CommandEmpty>
                <CommandGroup>
                  {props.tags.map((tag) => (
                    <CommandItem
                      key={tag}
                      value={tag}
                      data-checked={props.selectedTags.includes(tag)}
                      onSelect={() => toggleTag(tag)}
                    >
                      <span className="truncate">{tag}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
            {props.selectedTags.length ? (
              <div className="border-t p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => props.onTagsChange([])}
                >
                  {c.clearAll}
                </Button>
              </div>
            ) : null}
          </PopoverContent>
        </Popover>
        <Select
          value={props.status}
          onValueChange={(value) =>
            props.onStatusChange(value as Props["status"])
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue>
              {c.status}:{" "}
              {props.status === "all"
                ? c.any
                : props.status === "on"
                  ? c.on
                  : c.off}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">{c.any}</SelectItem>
              <SelectItem value="on">{c.on}</SelectItem>
              <SelectItem value="off">{c.off}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          aria-pressed={props.archived}
          className={props.archived ? "bg-accent text-accent-foreground" : ""}
          onClick={() => props.onArchivedChange(!props.archived)}
        >
          <Archive />
          {c.showArchived}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!filtersApplied}
          onClick={props.onClearFilters}
        >
          {c.clearFilters}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 2xl:justify-end">
        {props.selectedCount ? (
          <div className="flex items-center gap-2">
            <span className="text-sm whitespace-nowrap">
              {c.selected(props.selectedCount)}
            </span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    className="inline-flex"
                    tabIndex={props.canCopySelected ? -1 : 0}
                  />
                }
              >
                <Button
                  type="button"
                  variant="outline"
                  disabled={!props.canCopySelected}
                  onClick={props.onCopySelected}
                >
                  <Copy />
                  {c.copyTo}
                </Button>
              </TooltipTrigger>
              {!props.canCopySelected ? (
                <TooltipContent>{c.permissionDenied}</TooltipContent>
              ) : null}
            </Tooltip>
            <Button
              type="button"
              variant="ghost"
              onClick={props.onClearSelection}
            >
              {c.clear}
            </Button>
            <div className="mx-1 hidden h-8 w-px bg-border 2xl:block" />
          </div>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={props.onCompare}>
            <GitCompareArrows />
            {c.compare}
          </Button>
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  className="inline-flex"
                  tabIndex={props.canCreate ? -1 : 0}
                />
              }
            >
              <Button
                type="button"
                disabled={!props.canCreate}
                onClick={props.onCreate}
              >
                <Plus />
                {c.newFlag}
              </Button>
            </TooltipTrigger>
            {!props.canCreate ? (
              <TooltipContent>{c.permissionDenied}</TooltipContent>
            ) : null}
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
