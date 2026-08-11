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
import { SearchBox } from "@/features/workspace/global-users/components/shared"

export function DisplayColumnsMenu({
  options,
  selectedColumns,
  isLoading,
  onChange,
}: {
  options: string[]
  selectedColumns: string[]
  isLoading: boolean
  onChange: (columns: string[]) => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(search.trim().toLowerCase())
  )

  function toggleColumn(column: string) {
    onChange(
      selectedColumns.includes(column)
        ? selectedColumns.filter((item) => item !== column)
        : [...selectedColumns, column]
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" className="gap-2">
            <Columns3 className="size-4" />
            {t("workspace.globalUsers.display")}
            <ChevronDown className="size-4 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-64 p-3">
        <SearchBox
          value={search}
          placeholder={t("workspace.globalUsers.searchColumns")}
          onChange={setSearch}
        />
        <div className="mt-2 max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="px-1 py-3 text-sm text-muted-foreground">
              {t("workspace.globalUsers.loading")}
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="px-1 py-3 text-sm text-muted-foreground">
              {t("workspace.globalUsers.noColumnsFound")}
            </div>
          ) : (
            filteredOptions.map((option) => (
              <DropdownMenuItem
                key={option}
                className="cursor-pointer gap-3"
                closeOnClick={false}
                onClick={(event) => {
                  event.preventDefault()
                  toggleColumn(option)
                }}
              >
                <Checkbox
                  checked={selectedColumns.includes(option)}
                  className="pointer-events-none"
                />
                <span className="truncate">{option}</span>
              </DropdownMenuItem>
            ))
          )}
        </div>
        {selectedColumns.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 w-full justify-start gap-2"
              onClick={() => onChange([])}
            >
              <RotateCcw className="size-4" />
              {t("workspace.globalUsers.clearAll")}
            </Button>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
