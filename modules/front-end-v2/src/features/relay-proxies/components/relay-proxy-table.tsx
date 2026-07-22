import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { RelayProxy } from "../relay-proxy-types"

type Props = {
  items: RelayProxy[]
  isLoading: boolean
  canManage: boolean
  onEdit: (relayProxy: RelayProxy) => void
  onView: (relayProxy: RelayProxy) => void
  onRemove: (relayProxy: RelayProxy) => void
}

function formattedDate(value?: string) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date)
}

function environmentLabel(value: string) {
  const separator = value.indexOf(",")
  return separator >= 0 ? value.slice(separator + 1) : value
}

export function RelayProxyTable({
  items,
  isLoading,
  canManage,
  onEdit,
  onView,
  onRemove,
}: Props) {
  const { t } = useTranslation()
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="w-[20%] pl-4">
              {t("relayProxies.columns.relayProxy")}
            </TableHead>
            <TableHead className="w-[20%]">
              {t("relayProxies.columns.description")}
            </TableHead>
            <TableHead className="w-[24%]">
              {t("relayProxies.columns.serves")}
            </TableHead>
            <TableHead>{t("relayProxies.columns.agents")}</TableHead>
            <TableHead>{t("relayProxies.columns.lastUpdated")}</TableHead>
            <TableHead className="pr-4 text-right">
              {t("relayProxies.columns.actions")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 5 }, (_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 6 }, (_, cell) => (
                    <TableCell key={cell} className={cell === 0 ? "pl-4" : ""}>
                      <Skeleton className="h-5 w-full max-w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : items.map((relayProxy) => (
                <TableRow key={relayProxy.id}>
                  <TableCell className="pl-4 align-middle">
                    <button
                      type="button"
                      className="text-left font-medium hover:underline"
                      onClick={() =>
                        canManage ? onEdit(relayProxy) : onView(relayProxy)
                      }
                    >
                      {relayProxy.name}
                    </button>
                    <code className="mt-1 block max-w-48 truncate text-xs text-muted-foreground">
                      {relayProxy.key}
                    </code>
                  </TableCell>
                  <TableCell className="max-w-64 align-middle whitespace-normal text-muted-foreground">
                    {relayProxy.description || "—"}
                  </TableCell>
                  <TableCell className="max-w-80 align-middle whitespace-normal">
                    <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-xs">
                      {relayProxy.isAllEnvs ? (
                        <span>{t("relayProxies.actions.allEnvironments")}</span>
                      ) : relayProxy.serves.length > 0 ? (
                        relayProxy.serves.map((environment, index) => (
                          <span
                            key={`${environment}-${index}`}
                            className="rounded bg-muted px-1.5 py-0.5"
                          >
                            {environmentLabel(environment)}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground">
                          {t("relayProxies.actions.noEnvironments")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="align-middle">
                    <div className="space-y-1 text-xs">
                      <div>
                        <span className="font-medium">
                          {t("relayProxies.actions.auto")}
                        </span>{" "}
                        {relayProxy.autoAgents.length}
                      </div>
                      <div>
                        <span className="font-medium">
                          {t("relayProxies.actions.manual")}
                        </span>{" "}
                        {relayProxy.agents.length}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="align-middle text-xs text-muted-foreground">
                    {formattedDate(relayProxy.updatedAt)}
                  </TableCell>
                  <TableCell className="pr-4 align-middle">
                    <div className="flex justify-end gap-1">
                      {canManage ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(relayProxy)}
                          >
                            {t("relayProxies.actions.edit")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => onRemove(relayProxy)}
                          >
                            {t("relayProxies.actions.remove")}
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onView(relayProxy)}
                        >
                          {t("relayProxies.actions.view")}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  )
}
