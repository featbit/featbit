import { Loader2, Save } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  ACTION_BUTTON_CLASS,
  Field,
  OrganizationInput,
  ReadonlyCodeField,
} from "@/features/organization/general/components/organization-form-fields"
import {
  Section,
  SectionFooter,
} from "@/features/organization/general/components/section-shell"
import type { OrganizationDetails } from "@/features/organization/organization-api"

export function IdentitySection({
  organization,
  name,
  isSaving,
  onNameChange,
  onCopyId,
  onCopyKey,
  onSave,
}: {
  organization: OrganizationDetails
  name: string
  isSaving: boolean
  onNameChange: (value: string) => void
  onCopyId: () => void
  onCopyKey: () => void
  onSave: () => void
}) {
  const { t } = useTranslation()

  return (
    <Section>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave()
        }}
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <ReadonlyCodeField
            id="organizationId"
            label={t("organization.identity.id")}
            value={organization.id}
            onCopy={onCopyId}
          />
          <ReadonlyCodeField
            id="organizationKey"
            label={t("organization.identity.key")}
            value={organization.key}
            onCopy={onCopyKey}
          />
        </div>
        <div className="mt-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <Field
              id="organizationName"
              label={t("organization.identity.name")}
            >
              <OrganizationInput
                id="organizationName"
                value={name}
                disabled={isSaving}
                onChange={(event) => onNameChange(event.target.value)}
              />
            </Field>
          </div>
          <SectionFooter helper={t("organization.identity.helper")}>
            <Button
              type="submit"
              size="default"
              className={ACTION_BUTTON_CLASS}
              disabled={isSaving || !name.trim()}
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {t("organization.actions.saveChanges")}
            </Button>
          </SectionFooter>
        </div>
      </form>
    </Section>
  )
}
