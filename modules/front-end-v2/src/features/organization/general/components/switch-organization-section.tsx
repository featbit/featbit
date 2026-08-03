import { Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
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
import type { OrganizationDetails } from "@/features/organization/organization-api"

export function SwitchOrganizationSection({
  organizationId,
  organizations,
  onOrganizationChange,
  onCreateOrganization,
}: {
  organizationId: string
  organizations: OrganizationDetails[]
  onOrganizationChange: (value: string) => void
  onCreateOrganization: () => void
}) {
  const { t } = useTranslation()
  const organizationOptions = organizations.map((organization) => ({
    value: organization.id,
    label: organization.name,
  }))

  return (
    <Section title={t("organization.switch.title")}>
      <div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Field
            id="organizationSwitcher"
            label={t("organization.switch.organization")}
          >
            <OrganizationSelect
              value={organizationId}
              options={organizationOptions}
              ariaLabel={t("organization.switch.organization")}
              onChange={onOrganizationChange}
            />
          </Field>
        </div>
        <SectionFooter helper={t("organization.switch.helper")}>
          <Button
            type="button"
            variant="outline"
            className={ACTION_BUTTON_CLASS}
            onClick={onCreateOrganization}
          >
            <Plus className="size-4" />
            {t("organization.actions.createOrganization")}
          </Button>
        </SectionFooter>
      </div>
    </Section>
  )
}
