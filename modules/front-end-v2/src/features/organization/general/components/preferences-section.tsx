import { Loader2, Save } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ACTION_BUTTON_CLASS,
  Field,
  OrganizationSelect,
} from "@/features/organization/general/components/organization-form-fields"
import {
  Section,
  SectionFooter,
} from "@/features/organization/general/components/section-shell"
import type {
  FlagSortedBy,
  OrganizationGroup,
  OrganizationPolicy,
} from "@/features/organization/organization-api"
import { flagSortOptions } from "@/features/organization/organization-options"

function ensureSelectedOption(
  options: { value: string; label: string; badge?: string }[],
  value: string
) {
  if (!value || options.some((option) => option.value === value)) {
    return options
  }

  return [{ value, label: value }, ...options]
}

export function PreferencesSection({
  sortBy,
  policyId,
  groupId,
  policies,
  groups,
  policiesLoading,
  groupsLoading,
  isSavingSorting,
  isSavingPermissions,
  onSortByChange,
  onPolicyChange,
  onGroupChange,
  onSaveSorting,
  onSavePermissions,
}: {
  sortBy: FlagSortedBy
  policyId: string
  groupId: string
  policies: OrganizationPolicy[]
  groups: OrganizationGroup[]
  policiesLoading: boolean
  groupsLoading: boolean
  isSavingSorting: boolean
  isSavingPermissions: boolean
  onSortByChange: (value: FlagSortedBy) => void
  onPolicyChange: (value: string) => void
  onGroupChange: (value: string) => void
  onSaveSorting: () => void
  onSavePermissions: () => void
}) {
  const { t } = useTranslation()
  const policySelectOptions = ensureSelectedOption(
    policies.map((policy) => ({
      value: policy.id,
      label: policy.name,
      badge:
        policy.type === "SysManaged"
          ? t("organization.options.systemManaged")
          : undefined,
    })),
    policyId
  )
  const groupSelectOptions = ensureSelectedOption(
    groups.map((group) => ({
      value: group.id,
      label: group.name,
    })),
    groupId
  )
  const sortSelectOptions = flagSortOptions.map((option) => ({
    value: option.value,
    label: t(option.labelKey),
  }))

  return (
    <Section title={t("organization.preferences.title")}>
      <div className="space-y-8">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onSaveSorting()
          }}
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <Field
              id="organizationSort"
              label={t("organization.preferences.sortFlagsBy")}
            >
              <OrganizationSelect
                value={sortBy}
                options={sortSelectOptions}
                ariaLabel={t("organization.preferences.sortFlagsBy")}
                onChange={(value) => onSortByChange(value as FlagSortedBy)}
              />
            </Field>
          </div>
          <SectionFooter helper={t("organization.preferences.sortHelper")}>
            <Button
              type="submit"
              className={ACTION_BUTTON_CLASS}
              disabled={isSavingSorting}
            >
              {isSavingSorting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {t("organization.actions.saveSorting")}
            </Button>
          </SectionFooter>
        </form>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            onSavePermissions()
          }}
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <Field
              id="organizationPolicy"
              label={t("organization.preferences.defaultPolicy")}
            >
              <OrganizationSelect
                value={policyId}
                options={policySelectOptions}
                ariaLabel={t("organization.preferences.defaultPolicy")}
                disabled={policiesLoading}
                placeholder={
                  policiesLoading
                    ? t("organization.select.loading")
                    : t("organization.select.placeholder")
                }
                onChange={onPolicyChange}
                renderValue={(option) => (
                  <>
                    <span className="truncate">{option.label}</span>
                    {option.badge ? (
                      <Badge
                        variant="outline"
                        className="h-5 bg-background px-1.5 text-[0.65rem] font-medium text-muted-foreground"
                      >
                        {option.badge}
                      </Badge>
                    ) : null}
                  </>
                )}
              />
            </Field>
            <Field
              id="organizationGroup"
              label={t("organization.preferences.defaultGroup")}
            >
              <OrganizationSelect
                value={groupId}
                options={groupSelectOptions}
                ariaLabel={t("organization.preferences.defaultGroup")}
                disabled={groupsLoading}
                placeholder={
                  groupsLoading
                    ? t("organization.select.loading")
                    : t("organization.select.placeholder")
                }
                onChange={onGroupChange}
              />
            </Field>
          </div>
          <SectionFooter
            helper={t("organization.preferences.permissionsHelper")}
          >
            <Button
              type="submit"
              className={ACTION_BUTTON_CLASS}
              disabled={isSavingPermissions || (!policyId && !groupId)}
            >
              {isSavingPermissions ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {t("organization.actions.savePermissions")}
            </Button>
          </SectionFooter>
        </form>
      </div>
    </Section>
  )
}
