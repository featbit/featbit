import { Eye, EyeOff, Loader2, LockKeyhole, Save, ShieldCheck } from "lucide-react";
import type { FieldErrors, UseFormRegister, UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { InputField, TextInput } from "./form-fields";
import { Section } from "./workspace-shell";
import type { SsoFormValues } from "./workspace-types";

function SsoFields({
  register,
  errors,
  secretVisible,
  setSecretVisible,
  disabled
}: {
  register: UseFormRegister<SsoFormValues>;
  errors: FieldErrors<SsoFormValues>;
  secretVisible: boolean;
  setSecretVisible: (visible: boolean) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-x-5 gap-y-4 lg:grid-cols-2">
      <InputField id="clientId" label={t("workspace.general.sso.clientId")} error={errors.clientId?.message}>
        <TextInput id="clientId" disabled={disabled} error={errors.clientId?.message} {...register("clientId")} />
      </InputField>
      <InputField id="clientSecret" label={t("workspace.general.sso.clientSecret")} error={errors.clientSecret?.message}>
        <div className="relative">
          <TextInput
            id="clientSecret"
            type={secretVisible ? "text" : "password"}
            disabled={disabled}
            error={errors.clientSecret?.message}
            className="pr-10"
            {...register("clientSecret")}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-2 inline-flex w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:text-foreground disabled:cursor-default disabled:opacity-50"
            aria-label={secretVisible ? t("workspace.general.sso.hideSecret") : t("workspace.general.sso.showSecret")}
            disabled={disabled}
            onClick={() => setSecretVisible(!secretVisible)}
          >
            {secretVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </InputField>
      <InputField id="tokenEndpoint" label={t("workspace.general.sso.tokenEndpoint")} error={errors.tokenEndpoint?.message}>
        <TextInput id="tokenEndpoint" disabled={disabled} error={errors.tokenEndpoint?.message} {...register("tokenEndpoint")} />
      </InputField>
      <InputField id="clientAuthenticationMethod" label={t("workspace.general.sso.clientAuthenticationMethod")} error={errors.clientAuthenticationMethod?.message}>
        <TextInput id="clientAuthenticationMethod" disabled={disabled} error={errors.clientAuthenticationMethod?.message} {...register("clientAuthenticationMethod")} />
      </InputField>
      <InputField id="authorizationEndpoint" label={t("workspace.general.sso.authorizationEndpoint")} error={errors.authorizationEndpoint?.message}>
        <TextInput id="authorizationEndpoint" disabled={disabled} error={errors.authorizationEndpoint?.message} {...register("authorizationEndpoint")} />
      </InputField>
      <InputField id="scope" label={t("workspace.general.sso.scope")} error={errors.scope?.message}>
        <TextInput id="scope" disabled={disabled} error={errors.scope?.message} {...register("scope")} />
      </InputField>
      <InputField id="userEmailClaim" label={t("workspace.general.sso.userEmailClaim")} error={errors.userEmailClaim?.message}>
        <TextInput id="userEmailClaim" disabled={disabled} error={errors.userEmailClaim?.message} {...register("userEmailClaim")} />
      </InputField>
    </div>
  );
}

function RestrictedSsoSettings() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
          <LockKeyhole className="h-4 w-4" />
        </span>
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-semibold text-foreground">{t("workspace.general.sso.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("workspace.general.sso.restrictedDescription")}</p>
        </div>
      </div>
      <span className="inline-flex w-fit shrink-0 items-center rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
        {t("workspace.general.sso.restrictedBadge")}
      </span>
    </div>
  );
}

export function SsoSettingsSection({
  form,
  canUpdate,
  isSaving,
  secretVisible,
  setSecretVisible,
  onSubmit
}: {
  form: UseFormReturn<SsoFormValues>;
  canUpdate: boolean;
  isSaving: boolean;
  secretVisible: boolean;
  setSecretVisible: (visible: boolean) => void;
  onSubmit: (values: SsoFormValues) => void | Promise<void>;
}) {
  const { t } = useTranslation();

  return (
    <Section title={t("workspace.general.accessConfiguration")} className="pb-2">
      {canUpdate ? (
        <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-foreground">{t("workspace.general.sso.title")}</h3>
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <SsoFields
            register={form.register}
            errors={form.formState.errors}
            secretVisible={secretVisible}
            setSecretVisible={setSecretVisible}
            disabled={isSaving}
          />
          <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">{t("workspace.general.sso.helper")}</p>
            <Button type="submit" disabled={isSaving} className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? t("workspace.saving") : t("workspace.general.sso.save")}
            </Button>
          </div>
        </form>
      ) : (
        <RestrictedSsoSettings />
      )}
    </Section>
  );
}
