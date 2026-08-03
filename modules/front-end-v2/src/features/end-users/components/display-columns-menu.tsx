import { ChevronDown, Columns3, RotateCcw } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SearchInput } from "./shared"

export function DisplayColumnsMenu({
  options,
  selected,
  loading,
  onChange,
}: {
  options: string[]
  selected: string[]
  loading: boolean
  onChange: (columns: string[]) => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const filtered = options.filter((option) =>
    option.toLowerCase().includes(search.trim().toLowerCase())
  )

  function toggle(column: string) {
    onChange(
      selected.includes(column)
        ? selected.filter((item) => item !== column)
        : [...selected, column]
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="outline" className="gap-2" />}
      >
        <Columns3 className="size-4" />
        {t("endUsers.display")}
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-3">
        <SearchInput
          value={search}
          placeholder={t("endUsers.searchColumns")}
          onChange={setSearch}
        />
        <div className="mt-2 max-h-64 overflow-y-auto">
          {loading ? (
            <div className="px-1 py-3 text-sm text-muted-foreground">…</div>
          ) : filtered.length ? (
            filtered.map((option) => (
              <DropdownMenuItem
                key={option}
                closeOnClick={false}
                className="gap-3"
                onClick={(event) => {
                  event.preventDefault()
                  toggle(option)
                }}
              >
                <Checkbox
                  checked={selected.includes(option)}
                  className="pointer-events-none"
                />
                <span className="truncate">{option}</span>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="px-1 py-3 text-sm text-muted-foreground">
              {t("endUsers.noColumns")}
            </div>
          )}
        </div>
        {selected.length ? (
          <>
            <DropdownMenuSeparator />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 w-full justify-start"
              onClick={() => onChange([])}
            >
              <RotateCcw className="size-4" />
              {t("endUsers.clearAll")}
            </Button>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
