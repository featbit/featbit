import { Loader2, Save } from "lucide-react"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  PROFILE_ACTION_BUTTON_CLASS,
  ProfileInput,
} from "@/features/profile/components/profile-form-fields"
import {
  Section,
  SectionFooter,
} from "@/features/profile/components/section-shell"
import type { UserOrigin } from "@/features/profile/profile-api"

export type AccountDetailsValues = {
  name: string
  email: string
}

function accountTypeLabel(origin: UserOrigin | undefined) {
  if (origin === "Sso") {
    return "sso"
  }

  if (origin && origin !== "Local") {
    return "external"
  }

  return "local"
}

export function AccountDetailsSection({
  form,
  origin,
  isSaving,
  onSubmit,
}: {
  form: UseFormReturn<AccountDetailsValues>
  origin?: UserOrigin
  isSaving: boolean
  onSubmit: (values: AccountDetailsValues) => void | Promise<void>
}) {
  const { t } = useTranslation()
  const typeLabel = accountTypeLabel(origin)

  return (
    <Section title={t("profile.accountDetails.title")}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid gap-5 lg:grid-cols-2">
          <Field
            id="profileName"
            label={t("profile.accountDetails.name")}
            error={form.formState.errors.name?.message}
          >
            <ProfileInput
              id="profileName"
              disabled={isSaving}
              error={form.formState.errors.name?.message}
              {...form.register("name")}
            />
          </Field>
          <Field
            id="profileEmail"
            label={t("profile.accountDetails.email")}
            error={form.formState.errors.email?.message}
          >
            <ProfileInput
              id="profileEmail"
              type="email"
              disabled={isSaving}
              error={form.formState.errors.email?.message}
              {...form.register("email")}
            />
          </Field>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Field
            id="profileAccountType"
            label={t("profile.accountDetails.accountType")}
          >
            <div>
              <Badge variant="outline" className="bg-muted/50 font-normal">
                {t(`profile.accountTypes.${typeLabel}`)}
              </Badge>
            </div>
          </Field>
        </div>
        <SectionFooter helper={t("profile.accountDetails.helper")}>
          <Button
            type="submit"
            size="default"
            className={PROFILE_ACTION_BUTTON_CLASS}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {isSaving
              ? t("profile.saving")
              : t("profile.accountDetails.save")}
          </Button>
        </SectionFooter>
      </form>
    </Section>
  )
}
