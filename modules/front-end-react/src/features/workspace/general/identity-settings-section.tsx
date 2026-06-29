import { Loader2, Save } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { InputField, TextInput } from "./form-fields";
import { Section } from "./workspace-shell";
import type { IdentityFormValues } from "./workspace-types";

function PermissionNote({ show, text }: { show: boolean; text: string }) {
  return show ? <p className="text-xs text-muted-foreground">{text}</p> : null;
}

export function IdentitySettingsSection({
  form,
  canUpdate,
  isSaving,
  onSubmit
}: {
  form: UseFormReturn<IdentityFormValues>;
  canUpdate: boolean;
  isSaving: boolean;
  onSubmit: (values: IdentityFormValues) => void | Promise<void>;
}) {
  const { t } = useTranslation();

  return (
    <Section>
      <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid gap-5 lg:grid-cols-2">
          <InputField id="workspaceName" label={t("workspace.general.identity.name")} error={form.formState.errors.name?.message}>
            <TextInput
              id="workspaceName"
              disabled={!canUpdate || isSaving}
              error={form.formState.errors.name?.message}
              {...form.register("name")}
            />
          </InputField>
          <InputField id="workspaceKey" label={t("workspace.general.identity.key")} error={form.formState.errors.key?.message}>
            <TextInput
              id="workspaceKey"
              disabled={!canUpdate || isSaving}
              error={form.formState.errors.key?.message}
              {...form.register("key")}
            />
          </InputField>
        </div>
        <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{t("workspace.general.identity.helper")}</p>
            <PermissionNote show={!canUpdate} text={t("workspace.general.identity.permissionNote")} />
          </div>
          <Button type="submit" disabled={!canUpdate || isSaving} className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? t("workspace.saving") : t("workspace.general.identity.save")}
          </Button>
        </div>
      </form>
    </Section>
  );
}
