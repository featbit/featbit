import { LockKeyhole } from "lucide-react"
import { useState } from "react"
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
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<SelectionFilter>("all")
  const [search, setSearch] = useState("")
  const available = actionsForStatement(statement)
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
    onChange(next)
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
        manageLabel={t("iam.policies.details.permissionsEditor.manageActions")}
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
            onClick={() => onChange([])}
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
  )
}
