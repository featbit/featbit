export type PageCursor = {
  id: string
  updatedAt: string
  direction: "forward" | "backward" | string
}

export type CursorPagedResult<T> = {
  items: T[]
  previousCursor?: PageCursor
  nextCursor?: PageCursor
}

export type CustomizedProperty = {
  name: string
  value: string
}

export type EndUser = {
  id: string
  keyId: string
  name: string
  customizedProperties?: CustomizedProperty[]
}

export type PresetValue = {
  id: string
  value: string
  description: string
}

export type EndUserProperty = {
  id: string
  name: string
  presetValues: PresetValue[]
  usePresetValuesOnly: boolean
  isBuiltIn: boolean
  isDigestField: boolean
  remark: string
}

export type EndUserPropertyPayload = Pick<
  EndUserProperty,
  "name" | "presetValues" | "usePresetValuesOnly" | "isDigestField" | "remark"
>

export type PagedResult<T> = {
  totalCount: number
  items: T[]
}

export type EndUserFlag = {
  name: string
  key: string
  variationType: string
  variations: { id?: string; name?: string; value: string }[]
  matchVariation: string
  matchReason: string
}

export type EndUserSegment = {
  id: string
  name: string
  type: string
  updatedAt: string
}

export type EndUserFilter = {
  searchText: string
  pageSize: number
}
