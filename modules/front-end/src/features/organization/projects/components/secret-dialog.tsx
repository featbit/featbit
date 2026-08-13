import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Save } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  EnvironmentSecret,
  SecretType,
} from "@/features/organization/projects/projects-api"
import { Field } from "./form-field"

export type SecretValues = {
  name: string
  type: SecretType
}

export function SecretDialog({
  open,
  secret,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  secret: EnvironmentSecret | null
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: SecretValues) => void | Promise<void>
}) {
  const { t } = useTranslation()
  const isEditing = Boolean(secret)
  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t("organization.validation.nameRequired")),
        type: z.enum(["client", "server"]),
      }),
    [t]
  )
  const form = useForm<SecretValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", type: "client" },
  })

  useEffect(() => {
    form.reset({
      name: secret?.name ?? "",
      type: secret?.type ?? "client",
    })
  }, [form, open, secret])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t("organization.projects.forms.editSecretName")
              : t("organization.projects.forms.createSecret")}
          </DialogTitle>
          {isEditing ? (
            <DialogDescription>
              {t("organization.projects.helper.secretNameOnly")}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Field
            id="secretName"
            label={t("organization.projects.fields.name")}
            error={form.formState.errors.name?.message}
          >
            <Input
              id="secretName"
              disabled={saving}
              {...form.register("name")}
            />
          </Field>
          <Field id="secretType" label={t("organization.projects.fields.type")}>
            <Select
              value={form.watch("type")}
              onValueChange={(value) =>
                form.setValue("type", value as SecretType, {
                  shouldDirty: true,
                })
              }
              disabled={saving || isEditing}
            >
              <SelectTrigger id="secretType" className="w-full">
                <SelectValue>
                  {form.watch("type") === "server"
                    ? t("organization.projects.secretTypes.server")
                    : t("organization.projects.secretTypes.client")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="client">
                    {t("organization.projects.secretTypes.client")}
                  </SelectItem>
                  <SelectItem value="server">
                    {t("organization.projects.secretTypes.server")}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          {isEditing ? (
            <p className="text-xs text-muted-foreground">
              {t("organization.projects.helper.typeReadOnly")}
            </p>
          ) : null}
          <DialogFooter className="border-t-0 bg-transparent">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {isEditing
                ? t("organization.projects.actions.saveSecretName")
                : t("organization.projects.actions.createSecret")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
