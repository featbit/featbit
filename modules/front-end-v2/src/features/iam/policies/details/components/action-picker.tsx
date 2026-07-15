import { ChevronsUpDown, LockKeyhole } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SelectableCommandList } from "@/components/selectable-command-list"
import { Button } from "@/components/ui/button"
import { Command, CommandInput } from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { actionsForStatement, type PolicyStatement } from "../permission-model"

export function ActionPicker({
  statement,
  fineGrainedGranted,
  disabled,
  invalid,
  onChange,
}: {
  statement: PolicyStatement
  fineGrainedGranted: boolean
  disabled?: boolean
  invalid?: boolean
  onChange: (actions: string[]) => void
}) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [draft, setDraft] = useState(statement.actions)
  const available = actionsForStatement(statement)
  const visible = (() => {
    const query = search.trim().toLowerCase()
    if (!query) return available
    return available.filter((item) =>
      `${label(item.name)} ${item.name}`.toLocaleLowerCase().includes(query)
    )
  })()

  function label(name: string) {
    const item = available.find((candidate) => candidate.name === name)
    return t(`iam.policies.details.permissionsEditor.actionLabels.${name}`, {
      defaultValue: item?.label ?? name,
    })
  }

  function toggle(name: string) {
    setDraft((current) => {
      if (current.includes(name)) return current.filter((item) => item !== name)
      if (name === "*") return ["*"]
      return [...current.filter((item) => item !== "*"), name]
    })
  }

  const selectedLabels = statement.actions.slice(0, 2).map(label)
  const listFormatter = new Intl.ListFormat(
    i18n.resolvedLanguage === "zh" ? "zh-CN" : "en-US",
    { style: "short", type: "conjunction" }
  )
  const selectedSummary = listFormatter.format(selectedLabels)

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setDraft(statement.actions)
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-auto min-h-8 w-full justify-between px-3 py-2 font-normal",
              invalid && "border-destructive"
            )}
            disabled={disabled}
          >
            <span className="truncate text-left">
              {statement.actions.length
                ? statement.actions.length > 2
                  ? t(
                      "iam.policies.details.permissionsEditor.summaryOverflow",
                      {
                        items: selectedSummary,
                        count: statement.actions.length - 2,
                      }
                    )
                  : selectedSummary
                : t("iam.policies.details.permissionsEditor.selectActions")}
            </span>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent
        align="start"
        className="w-[min(28rem,calc(100vw-2rem))] p-0"
      >
        <Command shouldFilter={false} className="rounded-md">
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={t(
              "iam.policies.details.permissionsEditor.searchActions"
            )}
          />
          <SelectableCommandList
            items={visible}
            getKey={(item) => item.name}
            getValue={(item) => item.name}
            isSelected={(item) => draft.includes(item.name)}
            isDisabled={(item) =>
              Boolean(item.fineGrained && !fineGrainedGranted)
            }
            onSelect={(item) => toggle(item.name)}
            emptyContent={t("iam.policies.details.permissionsEditor.noActions")}
            renderItem={(item) => {
              const locked = Boolean(item.fineGrained && !fineGrainedGranted)
              return (
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{label(item.name)}</span>
                  {locked ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <LockKeyhole className="size-3" />
                      {t(
                        "iam.policies.details.permissionsEditor.enterpriseRequired"
                      )}
                    </span>
                  ) : null}
                </span>
              )
            }}
          />
        </Command>
        <div className="flex items-center justify-between border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDraft([])}
            disabled={!draft.length}
          >
            {t("iam.policies.details.permissionsEditor.clearAll")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onChange(draft)
              setOpen(false)
            }}
          >
            {t("iam.policies.details.permissionsEditor.done")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
