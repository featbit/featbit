import { fetchApi } from "@/lib/api/authenticated-api"

export type CustomizedProperty = {
  name: string
  value: string
}

export type GlobalUser = {
  id: string
  keyId: string
  name: string
  customizedProperties?: CustomizedProperty[]
}

export type PagedResult<T> = {
  totalCount: number
  items: T[]
}

function queryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value))
    }
  })

  const value = searchParams.toString()
  return value ? `?${value}` : ""
}

export function globalUsersTemplateUrl() {
  return "/assets/upload-global-users.json"
}

export async function fetchGlobalUsers(params: {
  name: string
  pageIndex: number
  pageSize: number
}) {
  return fetchApi<PagedResult<GlobalUser>>(
    `/api/v1/global-users${queryString({
      name: params.name,
      pageIndex: params.pageIndex,
      pageSize: params.pageSize,
    })}`
  )
}

export async function uploadGlobalUsers(file: File) {
  const formData = new FormData()
  formData.set("file", file)

  return fetchApi<boolean>("/api/v1/global-users/upload", {
    method: "POST",
    body: formData,
  })
}
