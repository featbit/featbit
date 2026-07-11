import { Star, X } from "lucide-react"
import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
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
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  addTeamMember,
  fetchGroupOptions,
  fetchPolicyOptions,
  type GroupOption,
  type PolicyOption,
} from "../team-api"

const loadPolicyOptions = (query: string) =>
  fetchPolicyOptions({ name: query }).then((result) => result.items)

const loadGroupOptions = (query: string) =>
  fetchGroupOptions({ name: query }).then((result) => result.items)

export function AddMemberSheet({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: () => void
}) {
  const { t } = useTranslation()
  const [email, setEmail] = useState("")
  const [policies, setPolicies] = useState<PolicyOption[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [emailError, setEmailError] = useState<string | null>(null)
  const [permissionsError, setPermissionsError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit() {
    const hasValidEmail = /^\S+@\S+\.\S+$/.test(email.trim())
    const hasPermissions = policies.length > 0 || groups.length > 0

    setEmailError(hasValidEmail ? null : t("iam.team.add.emailInvalid"))
    setPermissionsError(
      hasPermissions ? null : t("iam.team.add.permissionRequired")
    )

    if (!hasValidEmail || !hasPermissions) return

    setSaving(true)
    try {
      await addTeamMember({
        email: email.trim(),
        policyIds: policies.map((policy) => policy.id),
        groupIds: groups.map((group) => group.id),
      })
      toast.success(t("iam.team.operationSucceeded"))
      onAdded()
    } catch {
      toast.error(t("iam.team.operationFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-[min(100vw,500px)] data-[side=right]:sm:max-w-[500px]">
        <SheetHeader className="border-b px-6 py-5 pr-12">
          <SheetTitle>{t("iam.team.add.title")}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="team-member-email">{t("iam.team.add.email")}</Label>
            <Input
              id="team-member-email"
              value={email}
              placeholder={t("iam.team.add.emailPlaceholder")}
              aria-invalid={Boolean(emailError)}
              onChange={(event) => {
                const nextEmail = event.target.value
                setEmail(nextEmail)
                if (/^\S+@\S+\.\S+$/.test(nextEmail.trim())) {
                  setEmailError(null)
                }
              }}
            />
            {emailError ? (
              <p className="text-sm text-destructive">{emailError}</p>
            ) : null}
          </div>
          <section className="space-y-4">
            <div className="flex items-center gap-5">
              <h3 className="text-sm font-semibold text-foreground">
                {t("iam.team.add.permissions")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("iam.team.add.permissionsHint")}
              </p>
            </div>
            <PolicyMultiPicker
              selected={policies}
              onSelectedChange={(nextPolicies) => {
                setPolicies(nextPolicies)
                if (nextPolicies.length > 0 || groups.length > 0) {
                  setPermissionsError(null)
                }
              }}
            />
            <GroupMultiPicker
              selected={groups}
              onSelectedChange={(nextGroups) => {
                setGroups(nextGroups)
                if (policies.length > 0 || nextGroups.length > 0) {
                  setPermissionsError(null)
                }
              }}
            />
            {permissionsError ? (
              <p className="text-sm text-destructive">{permissionsError}</p>
            ) : null}
          </section>
        </div>
        <SheetFooter className="px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" disabled={saving} onClick={submit}>
            {saving ? t("iam.team.add.adding") : t("iam.team.add.submit")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function PolicyMultiPicker({
  selected,
  onSelectedChange,
}: {
  selected: PolicyOption[]
  onSelectedChange: (options: PolicyOption[]) => void
}) {
  const { t } = useTranslation()
  return (
    <PermissionMultiPicker
      label={t("iam.team.add.policies")}
      selectedLabel={t("iam.team.add.selectedPolicies")}
      placeholder={t("iam.team.add.searchPolicies")}
      emptyType={t("iam.team.add.policies")}
      selected={selected}
      onSelectedChange={onSelectedChange}
      getOptionMeta={(item) =>
        item.type === "SysManaged" ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3" />
            {t("iam.team.add.system")}
          </span>
        ) : null
      }
      loadOptions={loadPolicyOptions}
    />
  )
}

function GroupMultiPicker({
  selected,
  onSelectedChange,
}: {
  selected: GroupOption[]
  onSelectedChange: (options: GroupOption[]) => void
}) {
  const { t } = useTranslation()
  return (
    <PermissionMultiPicker
      label={t("iam.team.add.groups")}
      selectedLabel={t("iam.team.add.selectedGroups")}
      placeholder={t("iam.team.add.searchGroups")}
      emptyType={t("iam.team.add.groups")}
      selected={selected}
      onSelectedChange={onSelectedChange}
      loadOptions={loadGroupOptions}
    />
  )
}

function PermissionMultiPicker<TOption extends { id: string; name: string }>({
  label,
  selectedLabel,
  placeholder,
  emptyType,
  selected,
  onSelectedChange,
  loadOptions,
  getOptionMeta,
}: {
  label: string
  selectedLabel: string
  placeholder: string
  emptyType: string
  selected: TOption[]
  onSelectedChange: (options: TOption[]) => void
  loadOptions: (query: string) => Promise<TOption[]>
  getOptionMeta?: (option: TOption) => ReactNode
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const [options, setOptions] = useState<TOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const timeout = window.setTimeout(() => {
      setLoading(true)
      loadOptions(query)
        .then((items) => {
          if (!cancelled) setOptions(items)
        })
        .catch(() => {
          if (!cancelled) setOptions([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 200)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [loadOptions, query])

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return options
    return options.filter((option) =>
      option.name.toLocaleLowerCase().includes(normalizedQuery)
    )
  }, [options, query])

  function toggleOption(option: TOption) {
    const exists = selected.some((item) => item.id === option.id)
    onSelectedChange(
      exists
        ? selected.filter((item) => item.id !== option.id)
        : [...selected, option]
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-xs text-muted-foreground">
          {t("iam.team.add.selectedCount", { count: selected.length })}
        </span>
      </div>
      <Command
        shouldFilter={false}
        className="rounded-none p-0 [&_[data-slot=command-input-wrapper]]:p-0"
      >
        <div className="px-2 py-2">
          <CommandInput
            value={query}
            placeholder={placeholder}
            onValueChange={setQuery}
          />
        </div>
        <CommandList className="max-h-40 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] overflow-y-auto border-t pt-1 [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
          {loading ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-4/5" />
            </div>
          ) : (
            <>
              <CommandEmpty>{t("iam.team.add.noResults")}</CommandEmpty>
              <CommandGroup className="[&_[cmdk-group-items]]:space-y-1">
                {filteredOptions.map((option) => {
                  const isSelected = selected.some(
                    (item) => item.id === option.id
                  )
                  return (
                    <CommandItem
                      key={option.id}
                      value={`${option.name} ${option.id}`}
                      data-checked={isSelected}
                      className="border border-transparent data-[checked=true]:border-primary/20 data-[checked=true]:bg-primary/10 data-[checked=true]:text-foreground data-[checked=true]:*:[svg]:text-primary"
                      onSelect={() => toggleOption(option)}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {option.name}
                      </span>
                      {getOptionMeta?.(option)}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
      <div className="space-y-2 border-t bg-muted/30 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-foreground">
            {selectedLabel}
          </span>
          {selected.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onSelectedChange([])}
            >
              {t("iam.team.add.clearAll")}
            </Button>
          ) : null}
        </div>
        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((option) => (
              <Badge
                key={option.id}
                variant="outline"
                className="max-w-full gap-1 rounded-full border-primary/30 bg-primary/10 py-0.5 pr-1 pl-2 font-normal text-primary"
              >
                <span className="min-w-0 truncate">{option.name}</span>
                <button
                  type="button"
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                  onClick={() =>
                    onSelectedChange(
                      selected.filter((item) => item.id !== option.id)
                    )
                  }
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("iam.team.add.noneSelected", { type: emptyType })}
          </p>
        )}
      </div>
    </div>
  )
}
