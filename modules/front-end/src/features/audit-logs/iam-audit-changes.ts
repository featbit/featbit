import type { AuditLog } from "./audit-logs-types"

type Reference = { id: string; name: string; rn: string }
type Statement = {
  id: string
  effect: string
  resourceType: string
  resources: string[]
  actions: string[]
}
type Snapshot = {
  name?: string
  rn?: string
  email?: string
  description?: string
  members?: Reference[]
  groups?: Reference[]
  policies?: Reference[]
  statements?: Statement[]
}
export type IamChange = {
  field: string
  before: string
  after: string
  label?: string
  values?: string[]
}

export function isIamAudit(log: AuditLog) {
  return ["Member", "Group", "Policy"].includes(log.refType)
}

function snapshot(raw?: string): Snapshot {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Snapshot)
      : {}
  } catch {
    return {}
  }
}

export function iamChanges(log: AuditLog): IamChange[] {
  const before = snapshot(log.dataChange.previous)
  const after = snapshot(log.dataChange.current)
  const changes: IamChange[] = []
  for (const field of ["name", "email", "description"] as const) {
    if ((before[field] ?? "") !== (after[field] ?? ""))
      changes.push({
        field,
        before: before[field] ?? "",
        after: after[field] ?? "",
      })
  }
  for (const field of ["members", "groups", "policies"] as const) {
    const old = before[field] ?? [],
      current = after[field] ?? []
    for (const entry of old.filter((x) => !current.some((y) => y.id === x.id)))
      changes.push({ field, before: `${entry.name}\n${entry.rn}`, after: "" })
    for (const entry of current.filter((x) => !old.some((y) => y.id === x.id)))
      changes.push({ field, before: "", after: `${entry.name}\n${entry.rn}` })
  }
  const oldRules = before.statements ?? [],
    newRules = after.statements ?? []
  const ruleIds = [...new Set([...oldRules, ...newRules].map((x) => x.id))]
  for (const id of ruleIds) {
    const old = oldRules.find((x) => x.id === id),
      current = newRules.find((x) => x.id === id)
    for (const field of [
      "resourceType",
      "effect",
      "resources",
      "actions",
    ] as const) {
      const format = (value: Statement | undefined) =>
        Array.isArray(value?.[field])
          ? [...new Set(value![field] as string[])].sort().join("\n")
          : String(value?.[field] ?? "")
      const previous = format(old),
        next = format(current)
      if (previous !== next)
        changes.push({ field, before: previous, after: next, label: id })
    }
  }
  return changes
}

// Lifecycle details describe a resource's configuration, not a diff from {}.
export function iamSnapshotFields(log: AuditLog): IamChange[] {
  const data = snapshot(log.dataChange.current)
  if (!Object.keys(data).length) return []
  const fields: IamChange[] = []
  const add = (field: string, value: string | undefined, label?: string) =>
    fields.push({ field, before: "", after: value ?? "", label })
  add("name", data.name)
  if (log.refType === "Member") add("email", data.email)
  else add("description", data.description)
  const collections =
    log.refType === "Member"
      ? (["groups", "policies"] as const)
      : log.refType === "Group"
        ? (["members", "policies"] as const)
        : (["members", "groups"] as const)
  for (const field of collections) {
    fields.push({
      field,
      before: "",
      after: "",
      values: (data[field] ?? []).map((entry) => `${entry.name}\n${entry.rn}`),
    })
  }
  if (log.refType === "Policy") {
    const statements = data.statements ?? []
    if (!statements.length) add("statements", "")
    for (const statement of statements) {
      for (const field of [
        "resourceType",
        "effect",
        "resources",
        "actions",
      ] as const) {
        const value = statement[field]
        add(
          field,
          Array.isArray(value) ? [...new Set(value)].sort().join("\n") : value,
          statement.id
        )
      }
    }
  }
  return fields
}
