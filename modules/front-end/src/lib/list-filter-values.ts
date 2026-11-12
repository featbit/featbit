import type { OrganizationMember } from "@/features/organization/organization-members-api"

// Names are display hints only; requests always filter by the ID.
export function memberFilter(
  params: URLSearchParams,
  key: string
): OrganizationMember | null {
  const id = params.get(`${key}Id`)
  return id ? { id, name: params.get(`${key}Name`) || id, email: "" } : null
}
export function memberFilterParams(
  key: string,
  member: OrganizationMember | null
) {
  return {
    [`${key}Id`]: member?.id ?? null,
    [`${key}Name`]: member ? member.name || member.email || null : null,
  }
}
export function filterDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : undefined
}
export function filterDateParam(date: Date | undefined) {
  if (!date || !Number.isFinite(date.getTime())) return null
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}
