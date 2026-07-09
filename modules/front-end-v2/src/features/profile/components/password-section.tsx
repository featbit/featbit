import { Loader2, Save } from "lucide-react"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
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

export type PasswordValues = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export function PasswordSection({
  form,
  isSaving,
  onSubmit,
}: {
  form: UseFormReturn<PasswordValues>
  isSaving: boolean
  onSubmit: (values: PasswordValues) => void | Promise<void>
}) {
  const { t } = useTranslation()

  return (
    <Section title={t("profile.password.title")}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid gap-5 lg:grid-cols-2">
          <Field
            id="currentPassword"
            label={t("profile.password.currentPassword")}
            error={form.formState.errors.currentPassword?.message}
          >
            <ProfileInput
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              disabled={isSaving}
              error={form.formState.errors.currentPassword?.message}
              {...form.register("currentPassword")}
            />
          </Field>
          <Field
            id="newPassword"
            label={t("profile.password.newPassword")}
            error={form.formState.errors.newPassword?.message}
          >
            <ProfileInput
              id="newPassword"
              type="password"
              autoComplete="new-password"
              placeholder={t("profile.password.minimum")}
              disabled={isSaving}
              error={form.formState.errors.newPassword?.message}
              {...form.register("newPassword")}
            />
          </Field>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Field
            id="confirmPassword"
            label={t("profile.password.confirmPassword")}
            error={form.formState.errors.confirmPassword?.message}
          >
            <ProfileInput
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              disabled={isSaving}
              error={form.formState.errors.confirmPassword?.message}
              {...form.register("confirmPassword")}
            />
          </Field>
        </div>
        <SectionFooter helper={t("profile.password.helper")}>
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
            {isSaving ? t("profile.saving") : t("profile.password.reset")}
          </Button>
        </SectionFooter>
      </form>
    </Section>
  )
}
