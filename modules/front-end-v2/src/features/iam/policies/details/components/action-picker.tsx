import { CheckCheck, ListChecks, LockKeyhole } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { SelectedItemsField } from "@/components/selected-items-field"
import { SelectableCommandList } from "@/components/selectable-command-list"
import {
  SelectionFilterTabs,
  type SelectionFilter,
} from "@/components/selection-filter-tabs"
import { StablePopoverContent } from "@/components/stable-popover-content"
import { Button } from "@/components/ui/button"
import { Command, CommandInput } from "@/components/ui/command"
import { Popover } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { actionsForStatement, type PolicyStatement } from "../permission-model"

type ActionMode = "all" | "specific"

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
  const { t } = useTranslation()
  const modeDescriptionId = useId()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<SelectionFilter>("all")
  const [search, setSearch] = useState("")
  const available = actionsForStatement(statement).filter(
    (action) => action.name !== "*"
  )
  const supportsSpecific = available.some(
    (action) => !action.fineGrained || fineGrainedGranted
  )
  const mode: ActionMode =
    !supportsSpecific || statement.actions.includes("*") ? "all" : "specific"
  const visible = (() => {
    const query = search.trim().toLowerCase()
    const filtered =
      filter === "selected"
        ? available.filter((item) => statement.actions.includes(item.name))
        : available
    if (!query) return filtered
    return filtered.filter((item) =>
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
    const next = statement.actions.includes(name)
      ? statement.actions.filter((item) => item !== name)
      : name === "*"
        ? ["*"]
        : [...statement.actions.filter((item) => item !== "*"), name]
    if (next.length === 0) setFilter("all")
    onChange(next)
  }

  function changeMode(next: ActionMode) {
    if (next === "all") {
      onChange(["*"])
      setOpen(false)
      return
    }
    if (!supportsSpecific) return
    onChange([])
    setFilter("all")
    setSearch("")
    setOpen(false)
  }

  const selectedActions = statement.actions.map((name) => {
    const item = available.find((candidate) => candidate.name === name)
    return {
      name,
      label: label(name),
      locked: Boolean(item?.fineGrained && !fineGrainedGranted),
    }
  })

  return (
    <div className="space-y-2">
      <div className="grid gap-x-2 gap-y-1 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          aria-pressed={mode === "all"}
          aria-describedby={modeDescriptionId}
          className={cn(
            "h-8 justify-start gap-2 px-3 text-left whitespace-normal",
            mode === "all" &&
              "border-primary bg-primary/5 hover:border-primary hover:bg-primary/10"
          )}
          disabled={disabled}
          onClick={() => changeMode("all")}
        >
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
              mode === "all" && "bg-primary text-primary-foreground"
            )}
          >
            <CheckCheck className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1 truncate font-medium text-foreground">
            {t("iam.policies.details.permissionsEditor.allActions")}
          </span>
        </Button>
        {supportsSpecific ? (
          <Button
            type="button"
            variant="outline"
            aria-pressed={mode === "specific"}
            aria-describedby={modeDescriptionId}
            className={cn(
              "h-8 justify-start gap-2 px-3 text-left whitespace-normal",
              mode === "specific" &&
                "border-primary bg-primary/5 hover:border-primary hover:bg-primary/10"
            )}
            disabled={disabled}
            onClick={() => changeMode("specific")}
          >
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
                mode === "specific" && "bg-primary text-primary-foreground"
              )}
            >
              <ListChecks className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">
              {t("iam.policies.details.permissionsEditor.specificActions")}
            </span>
          </Button>
        ) : null}
        <p
          id={modeDescriptionId}
          className="text-xs text-muted-foreground sm:col-span-2"
        >
          {mode === "all"
            ? t("iam.policies.details.permissionsEditor.allActionsDescription")
            : t(
                "iam.policies.details.permissionsEditor.specificActionsDescription"
              )}
        </p>
      </div>

      {mode === "specific" ? (
        <Popover
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen)
            if (nextOpen) setFilter("all")
          }}
        >
          <SelectedItemsField
            items={selectedActions}
            getKey={(action) => action.name}
            getLabel={(action) => action.label}
            getDescription={(action) => action.name}
            heading={t(
              "iam.policies.details.permissionsEditor.selectedActionsHeading",
              { count: statement.actions.length }
            )}
            manageLabel={t(
              "iam.policies.details.permissionsEditor.manageActions"
            )}
            emptyContent={t(
              "iam.policies.details.permissionsEditor.noSelectedActions"
            )}
            removeLabel={(action) =>
              t("iam.policies.details.permissionsEditor.removeSelectedAction", {
                name: action.label,
              })
            }
            onRemove={(action) => toggle(action.name)}
            isItemDisabled={(action) => action.locked}
            disabled={disabled}
            invalid={invalid}
          />
          <StablePopoverContent
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
              <SelectionFilterTabs
                value={filter}
                onValueChange={setFilter}
                allLabel={t("iam.policies.details.permissionsEditor.allFilter")}
                selectedLabel={(count) =>
                  t("iam.policies.details.permissionsEditor.selectedFilter", {
                    count,
                  })
                }
                selectedCount={statement.actions.length}
              />
              <SelectableCommandList
                items={visible}
                getKey={(item) => item.name}
                getValue={(item) => item.name}
                isSelected={(item) => statement.actions.includes(item.name)}
                isDisabled={(item) =>
                  Boolean(item.fineGrained && !fineGrainedGranted)
                }
                onSelect={(item) => toggle(item.name)}
                emptyContent={t(
                  filter === "selected"
                    ? "iam.policies.details.permissionsEditor.noActionsSelected"
                    : "iam.policies.details.permissionsEditor.noActions"
                )}
                listClassName="max-h-[clamp(10rem,40dvh,18rem)] [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] overflow-y-auto [&_[data-slot=command-empty]]:flex [&_[data-slot=command-empty]]:min-h-20 [&_[data-slot=command-empty]]:items-center [&_[data-slot=command-empty]]:justify-center [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
                renderItem={(item) => {
                  const locked = Boolean(
                    item.fineGrained && !fineGrainedGranted
                  )
                  const actionLabel = label(item.name)
                  return (
                    <span className="min-w-0 flex-1">
                      <span className="block truncate leading-5 font-medium">
                        {actionLabel}
                      </span>
                      <span className="flex min-w-0 items-start gap-2 text-xs leading-4 text-muted-foreground">
                        <span
                          aria-hidden="true"
                          className="min-w-0 font-mono [overflow-wrap:anywhere] break-words"
                        >
                          {item.name}
                        </span>
                        <span className="sr-only">, {item.name}. </span>
                        {locked ? (
                          <span className="ml-auto flex shrink-0 items-center gap-1">
                            <LockKeyhole className="size-3" />
                            {t(
                              "iam.policies.details.permissionsEditor.enterpriseRequired"
                            )}
                          </span>
                        ) : null}
                      </span>
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
                onClick={() => {
                  setFilter("all")
                  onChange([])
                }}
                disabled={!statement.actions.length}
              >
                {t("iam.policies.details.permissionsEditor.clearAll")}
              </Button>
              <Button type="button" size="sm" onClick={() => setOpen(false)}>
                {t("iam.policies.details.permissionsEditor.done")}
              </Button>
            </div>
          </StablePopoverContent>
        </Popover>
      ) : null}
    </div>
  )
}
