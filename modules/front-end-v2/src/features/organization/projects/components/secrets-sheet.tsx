import { Copy, Edit, Plus, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  EnvironmentSecret,
  OrganizationProject,
  ProjectEnvironment,
} from "@/features/organization/projects/projects-api"
import { IconTooltip, maskSecret, TypeBadge } from "./inventory-shared"

export function SecretsSheet({
  open,
  project,
  environment,
  onOpenChange,
  onAddSecret,
  onCopySecret,
  onEditSecret,
  onDeleteSecret,
}: {
  open: boolean
  project: OrganizationProject | null
  environment: ProjectEnvironment | null
  onOpenChange: (open: boolean) => void
  onAddSecret: (environment: ProjectEnvironment) => void
  onCopySecret: (value: string) => void
  onEditSecret: (secret: EnvironmentSecret) => void
  onDeleteSecret: (secret: EnvironmentSecret) => void
}) {
  const { t } = useTranslation()
  const title = environment
    ? t("organization.projects.secretsTitle", { name: environment.name })
    : t("organization.projects.columns.secrets")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-[min(100vw,520px)] data-[side=right]:sm:max-w-[520px]">
        <SheetHeader className="border-b px-6 py-5 pr-12">
          <SheetTitle>{title}</SheetTitle>
          {project && environment ? (
            <SheetDescription>
              {project.name} / {environment.name}
            </SheetDescription>
          ) : null}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-4 flex justify-end">
            {environment ? (
              <Button
                type="button"
                size="sm"
                onClick={() => onAddSecret(environment)}
              >
                <Plus className="size-3.5" />
                {t("organization.projects.actions.addSecret")}
              </Button>
            ) : null}
          </div>
          <div className="overflow-hidden rounded-md border">
            <Table className="table-fixed">
              <TableHeader className="bg-muted/40 text-left">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-3 py-2 font-medium">
                    {t("organization.projects.fields.name")}
                  </TableHead>
                  <TableHead className="w-[116px] px-3 py-2 font-medium">
                    {t("organization.projects.fields.type")}
                  </TableHead>
                  <TableHead className="w-[120px] px-3 py-2 font-medium">
                    {t("organization.projects.fields.value")}
                  </TableHead>
                  <TableHead className="w-[92px] px-3 py-2 text-right font-medium">
                    {t("organization.projects.columns.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {environment?.secrets.length ? (
                  environment.secrets.map((secret) => (
                    <TableRow key={secret.id}>
                      <TableCell className="truncate px-3 py-2 align-middle">
                        {secret.name}
                      </TableCell>
                      <TableCell className="px-3 py-2 align-middle">
                        <TypeBadge type={secret.type} />
                      </TableCell>
                      <TableCell className="truncate px-3 py-2 align-middle font-mono text-xs text-muted-foreground">
                        {maskSecret(secret.value)}
                      </TableCell>
                      <TableCell className="px-3 py-2 align-middle">
                        <div className="flex justify-end gap-1">
                          <IconTooltip
                            label={t("organization.projects.actions.copySecret")}
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              aria-label={t(
                                "organization.projects.actions.copySecret"
                              )}
                              onClick={() => onCopySecret(secret.value)}
                            >
                              <Copy className="size-3" />
                            </Button>
                          </IconTooltip>
                          <IconTooltip
                            label={t(
                              "organization.projects.actions.editSecretName"
                            )}
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              aria-label={t(
                                "organization.projects.actions.editSecretName"
                              )}
                              onClick={() => onEditSecret(secret)}
                            >
                              <Edit className="size-3" />
                            </Button>
                          </IconTooltip>
                          <IconTooltip
                            label={t("organization.projects.actions.deleteSecret")}
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              aria-label={t(
                                "organization.projects.actions.deleteSecret"
                              )}
                              onClick={() => onDeleteSecret(secret)}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </IconTooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="px-3 py-6 text-center text-sm text-muted-foreground"
                    >
                      {t("organization.projects.emptySecrets")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
