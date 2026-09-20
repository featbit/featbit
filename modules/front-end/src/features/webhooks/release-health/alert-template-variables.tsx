import { useState } from "react"
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
import { ALERT_TEMPLATE_GROUPS } from "./alert-template-schema"

export function AlertTemplateVariables() {
  const { t } = useTranslation()
  const h = (key: string) => t(`webhooks.releaseHealth.${key}`)
  const [selected, setSelected] = useState("event")
  const groups = ALERT_TEMPLATE_GROUPS
  const group = groups.find((item) => item.name === selected)!
  return (
    <details open className="rounded-lg border px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium">
        {h("variables")}
      </summary>
      <div className="mt-3 space-y-4">
        <p className="text-xs leading-5 text-muted-foreground">
          {h("variablesHelp")}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={selected}
            onValueChange={(value) => value && setSelected(value)}
          >
            <SelectTrigger
              aria-label={h("variableGroup")}
              className="w-full sm:w-80"
            >
              <SelectValue>{group.path}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {groups.map((item) => (
                  <SelectItem key={item.name} value={item.name}>
                    {item.path}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <p className="min-w-48 flex-1 text-xs text-muted-foreground">
            {h(`variableGroups.${group.name}`)}
          </p>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table
            className="w-full text-left text-xs"
            aria-label={h("variables")}
          >
            <thead className="bg-muted/40">
              <tr className="border-b">
                <th scope="col" className="p-3 font-medium">
                  {h("templateExpression")}
                </th>
                <th scope="col" className="p-3 font-medium">
                  {h("fieldDefinition")}
                </th>
              </tr>
            </thead>
            <tbody>
              {group.fields.map((field) => (
                <tr key={field.path} className="border-b last:border-b-0">
                  <th scope="row" className="p-3 align-top font-normal">
                    <code className="break-all">{field.expression}</code>
                    <span className="mt-1 block text-muted-foreground">
                      {field.type}
                    </span>
                  </th>
                  <td className="p-3 align-top">
                    {field.values && (
                      <div
                        className="mt-2 flex flex-wrap gap-1"
                        aria-label={h("allowedValues")}
                      >
                        {field.values.map((value) => (
                          <Badge
                            key={String(value)}
                            variant="outline"
                            className="font-mono text-[10px] font-normal"
                          >
                            {String(value)}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {field.note && (
                      <p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">
                        {h(`fieldNotes.${field.note}`)}
                      </p>
                    )}
                    {!field.values && !field.note && (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {h("wholeObjectHelp")}{" "}
          <code className="text-foreground">{group.expression}</code>
        </p>
      </div>
    </details>
  )
}
