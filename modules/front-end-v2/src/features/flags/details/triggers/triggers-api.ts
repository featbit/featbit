import { fetchApi } from "@/lib/api/authenticated-api"
import { getRuntimeEnv } from "@/lib/env/runtime-env"

export type FlagTriggerAction = "turn-on" | "turn-off"
export type FlagTriggerType = "feature-flag-general"

export type FlagTrigger = {
  id: string
  createdAt?: string
  updatedAt?: string
  targetId: string
  type: FlagTriggerType
  action: FlagTriggerAction
  token?: string
  description?: string
  isEnabled: boolean
  triggeredTimes?: number
  lastTriggeredAt?: string
}

export type CreateFlagTriggerInput = {
  targetId: string
  type: FlagTriggerType
  action: FlagTriggerAction
  description: string
}

const TRIGGERS_PATH = "/api/v1/triggers"

export function fetchFlagTriggers(targetId: string) {
  const params = new URLSearchParams({ targetId })
  return fetchApi<FlagTrigger[]>(`${TRIGGERS_PATH}?${params}`)
}

export function createFlagTrigger(input: CreateFlagTriggerInput) {
  return fetchApi<FlagTrigger>(TRIGGERS_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
}

export function updateFlagTriggerStatus(id: string, isEnabled: boolean) {
  return fetchApi<boolean>(`${TRIGGERS_PATH}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isEnabled }),
  })
}

export function resetFlagTriggerUrl(id: string) {
  return fetchApi<string>(
    `${TRIGGERS_PATH}/${encodeURIComponent(id)}/reset-token`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }
  )
}

export function removeFlagTrigger(id: string) {
  return fetchApi<boolean>(`${TRIGGERS_PATH}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}

export function flagTriggerUrl(token: string) {
  return `${getRuntimeEnv().apiUrl}${TRIGGERS_PATH}/run/${token}`
}

export function maskedFlagTriggerUrl() {
  return `${getRuntimeEnv().apiUrl}${TRIGGERS_PATH}/run/••••••`
}
