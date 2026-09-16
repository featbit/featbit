import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
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
import { AuditResult } from "./audit-log-table"
import type { ReleaseHealthAuditLog } from "./audit-log-samples"

export function AuditLogDetails({
  record,
  project,
  environment,
  onClose,
}: {
  record: ReleaseHealthAuditLog | null
  project: string
  environment: string
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const a = (key: string) => t(`releaseHealth.audit.${key}`)
  return (
    <Sheet open={record !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto data-[side=right]:w-[calc(100%-1rem)] data-[side=right]:max-w-[calc(100%-1rem)] data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="px-6">
          <SheetTitle>{a("details")}</SheetTitle>
          <SheetDescription>{record?.object.name}</SheetDescription>
        </SheetHeader>
        {record && (
          <div className="space-y-6 px-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{a(`modules.${record.module}`)}</Badge>
              <span className="font-medium">
                {a(`actions.${record.action}`)}
              </span>
              <AuditResult result={record.result} />
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              {[
                [a("eventId"), record.id],
                [
                  a("time"),
                  new Date(record.occurredAt).toLocaleString(
                    i18n.language === "zh" ? "zh-CN" : "en-US",
                    { hour12: false }
                  ),
                ],
                [a("object"), record.object.key],
                [a("actor"), `${record.actor.name} · ${a(record.actor.kind)}`],
                [a("source"), record.source],
                [a("projectName"), project],
                [
                  a("scope"),
                  record.scope === "project" ? a("project") : environment,
                ],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="mb-1 text-xs text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="break-words">{value}</dd>
                </div>
              ))}
            </dl>
            {record.note && (
              <p
                className={`rounded-md border p-3 text-sm ${record.result === "failed" ? "border-destructive/30 text-destructive" : "text-muted-foreground"}`}
              >
                {a(`notes.${record.note}`)}
              </p>
            )}
            {record.changes.length > 0 && (
              <section>
                <h3 className="mb-3 text-sm font-medium">{a("changes")}</h3>
                <div className="overflow-hidden rounded-md border">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/4">{a("field")}</TableHead>
                        <TableHead>{a("before")}</TableHead>
                        <TableHead>{a("after")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {record.changes.map((change) => (
                        <TableRow key={change.field}>
                          <TableCell className="align-top whitespace-normal text-muted-foreground">
                            {a(`fields.${change.field}`)}
                          </TableCell>
                          <TableCell className="align-top break-words whitespace-pre-wrap">
                            {change.before ?? (
                              <span className="text-muted-foreground">
                                {a("unset")}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="align-top break-words whitespace-pre-wrap">
                            {change.after ?? (
                              <span className="text-muted-foreground">
                                {a("removed")}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            )}
          </div>
        )}
        <SheetFooter className="px-6">
          <Button variant="outline" onClick={onClose}>
            {a("close")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
