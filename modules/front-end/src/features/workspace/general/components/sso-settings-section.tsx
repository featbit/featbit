import { Eye, EyeOff, KeyRound, Loader2, LockKeyhole, Save } from "lucide-react"
import { Controller } from "react-hook-form"
import type {
  Control,
  FieldErrors,
  UseFormRegister,
  UseFormReturn,
} from "react-hook-form"
import { useTranslation } from "react-i18next"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  InputField,
  TextInput,
} from "@/features/workspace/general/components/form-fields"
import { Section } from "@/features/workspace/general/components/workspace-shell"
import type { SsoFormValues } from "@/features/workspace/general/workspace-types"

const authenticationMethods = ["client_secret_basic", "client_secret_post"]

function SsoFields({
  control,
  register,
  errors,
  secretVisible,
  setSecretVisible,
  disabled,
}: {
  control: Control<SsoFormValues>
  register: UseFormRegister<SsoFormValues>
  errors: FieldErrors<SsoFormValues>
  secretVisible: boolean
  setSecretVisible: (visible: boolean) => void
  disabled: boolean
}) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-x-5 gap-y-4 lg:grid-cols-2">
      <InputField
        id="clientId"
        label={t("workspace.general.sso.clientId")}
        description={t("workspace.general.sso.clientIdDescription")}
        error={errors.clientId?.message}
      >
        <TextInput
          id="clientId"
          placeholder={t("workspace.general.sso.clientIdPlaceholder")}
          aria-describedby="clientId-description"
          disabled={disabled}
          error={errors.clientId?.message}
          {...register("clientId")}
        />
      </InputField>
      <InputField
        id="clientSecret"
        label={t("workspace.general.sso.clientSecret")}
        description={t("workspace.general.sso.clientSecretDescription")}
        error={errors.clientSecret?.message}
      >
        <div className="relative">
          <TextInput
            id="clientSecret"
            placeholder={t("workspace.general.sso.clientSecretPlaceholder")}
            aria-describedby="clientSecret-description"
            type={secretVisible ? "text" : "password"}
            disabled={disabled}
            error={errors.clientSecret?.message}
            className="pr-10"
            {...register("clientSecret")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
            aria-label={
              secretVisible
                ? t("workspace.general.sso.hideSecret")
                : t("workspace.general.sso.showSecret")
            }
            disabled={disabled}
            onClick={() => setSecretVisible(!secretVisible)}
          >
            {secretVisible ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </Button>
        </div>
      </InputField>
      <InputField
        id="tokenEndpoint"
        label={t("workspace.general.sso.tokenEndpoint")}
        description={t("workspace.general.sso.tokenEndpointDescription")}
        error={errors.tokenEndpoint?.message}
      >
        <TextInput
          id="tokenEndpoint"
          placeholder={t("workspace.general.sso.tokenEndpointPlaceholder")}
          aria-describedby="tokenEndpoint-description"
          disabled={disabled}
          error={errors.tokenEndpoint?.message}
          {...register("tokenEndpoint")}
        />
      </InputField>
      <InputField
        id="clientAuthenticationMethod"
        label={t("workspace.general.sso.clientAuthenticationMethod")}
        description={t(
          "workspace.general.sso.clientAuthenticationMethodDescription"
        )}
        error={errors.clientAuthenticationMethod?.message}
      >
        <Controller
          name="clientAuthenticationMethod"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value || null}
              disabled={disabled}
              onValueChange={(value) => field.onChange(value ?? "")}
            >
              <SelectTrigger
                id="clientAuthenticationMethod"
                ref={field.ref}
                onBlur={field.onBlur}
                aria-invalid={Boolean(errors.clientAuthenticationMethod)}
                aria-describedby="clientAuthenticationMethod-description"
                className="w-full"
              >
                <SelectValue>
                  {field.value ||
                    t(
                      "workspace.general.sso.clientAuthenticationMethodPlaceholder"
                    )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {field.value &&
                  !authenticationMethods.includes(field.value) ? (
                    <SelectItem value={field.value}>{field.value}</SelectItem>
                  ) : null}
                  {authenticationMethods.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        />
      </InputField>
      <InputField
        id="authorizationEndpoint"
        label={t("workspace.general.sso.authorizationEndpoint")}
        description={t(
          "workspace.general.sso.authorizationEndpointDescription"
        )}
        error={errors.authorizationEndpoint?.message}
      >
        <TextInput
          id="authorizationEndpoint"
          placeholder={t(
            "workspace.general.sso.authorizationEndpointPlaceholder"
          )}
          aria-describedby="authorizationEndpoint-description"
          disabled={disabled}
          error={errors.authorizationEndpoint?.message}
          {...register("authorizationEndpoint")}
        />
      </InputField>
      <InputField
        id="scope"
        label={t("workspace.general.sso.scope")}
        description={t("workspace.general.sso.scopeDescription")}
        error={errors.scope?.message}
      >
        <TextInput
          id="scope"
          placeholder={t("workspace.general.sso.scopePlaceholder")}
          aria-describedby="scope-description"
          disabled={disabled}
          error={errors.scope?.message}
          {...register("scope")}
        />
      </InputField>
      <InputField
        id="userEmailClaim"
        label={t("workspace.general.sso.userEmailClaim")}
        description={t("workspace.general.sso.userEmailClaimDescription")}
        error={errors.userEmailClaim?.message}
      >
        <TextInput
          id="userEmailClaim"
          placeholder={t("workspace.general.sso.userEmailClaimPlaceholder")}
          aria-describedby="userEmailClaim-description"
          disabled={disabled}
          error={errors.userEmailClaim?.message}
          {...register("userEmailClaim")}
        />
      </InputField>
    </div>
  )
}

function RestrictedSsoSettings() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex shrink-0 items-center text-muted-foreground">
          <LockKeyhole className="size-4" />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">
            {t("workspace.general.sso.restrictedDescription")}
          </p>
        </div>
      </div>
      <Badge
        variant="outline"
        className="shrink-0 self-start bg-background text-muted-foreground sm:self-center"
      >
        {t("workspace.general.sso.restrictedBadge")}
      </Badge>
    </div>
  )
}

function UnlicensedSsoSettings() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex shrink-0 items-center text-muted-foreground">
          <KeyRound className="size-4" />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">
            {t("workspace.general.sso.unlicensedDescription")}
          </p>
        </div>
      </div>
    </div>
  )
}

export function SsoSettingsSection({
  form,
  isLicensed,
  canUpdate,
  isSaving,
  secretVisible,
  setSecretVisible,
  onSubmit,
}: {
  form: UseFormReturn<SsoFormValues>
  isLicensed: boolean
  canUpdate: boolean
  isSaving: boolean
  secretVisible: boolean
  setSecretVisible: (visible: boolean) => void
  onSubmit: (values: SsoFormValues) => void | Promise<void>
}) {
  const { t } = useTranslation()

  return (
    <Section
      title={t("workspace.general.sso.title")}
      className="pb-2"
      description={
        <p>
          {t("workspace.general.sso.helper")}{" "}
          <a
            href="https://docs.featbit.co/integrations/single-sign-on/single-sign-on"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 whitespace-nowrap text-foreground underline underline-offset-4 hover:text-muted-foreground"
          >
            {t("workspace.general.sso.setupGuide")}
          </a>
        </p>
      }
    >
      {!isLicensed ? (
        <UnlicensedSsoSettings />
      ) : canUpdate ? (
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div>
            <SsoFields
              control={form.control}
              register={form.register}
              errors={form.formState.errors}
              secretVisible={secretVisible}
              setSecretVisible={setSecretVisible}
              disabled={isSaving}
            />
          </div>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-end">
            <Button type="submit" size="lg" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {isSaving
                ? t("workspace.saving")
                : t("workspace.general.sso.save")}
            </Button>
          </div>
        </form>
      ) : (
        <RestrictedSsoSettings />
      )}
    </Section>
  )
}
