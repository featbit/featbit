import { fetchApi } from "@/lib/api/authenticated-api"

export type OrganizationMember = {
  id: string
  name: string
  email: string
}

export function fetchOrganizationMembers(input: {
  searchText: string
  pageIndex?: number
  pageSize?: number
}) {
  const params = new URLSearchParams({
    searchText: input.searchText,
    pageIndex: String(input.pageIndex ?? 0),
    pageSize: String(input.pageSize ?? 20),
  })

  return fetchApi<{ items: OrganizationMember[]; totalCount: number }>(
    `/api/v1/user/organization-members?${params}`
  )
}
