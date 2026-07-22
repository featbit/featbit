export type WebhookHeader = {
  key: string
  value: string
}

export type WebhookCreator = {
  id?: string
  name?: string
  email?: string
}

export type LastDelivery = {
  success: boolean
  happenedAt: string
  response: number
}

export type Webhook = {
  id: string
  name: string
  scopes: string[]
  scopeNames: string[]
  url: string
  secret: string
  events: string[]
  headers: WebhookHeader[]
  payloadTemplateType: "default" | "custom"
  payloadTemplate: string
  isActive: boolean
  preventEmptyPayloads: boolean
  creator: WebhookCreator
  lastDelivery?: LastDelivery | null
}

export type WebhookPayload = Pick<
  Webhook,
  | "name"
  | "scopes"
  | "url"
  | "events"
  | "headers"
  | "payloadTemplateType"
  | "payloadTemplate"
  | "secret"
  | "isActive"
  | "preventEmptyPayloads"
>

export type PagedWebhooks = {
  totalCount: number
  items: Webhook[]
}

export type DeliveryRequest = {
  url: string
  headers: Record<string, string> | WebhookHeader[]
  payload: string
}

export type DeliveryResponse = {
  statusCode: number
  reasonPhrase: string
  headers: Record<string, string> | WebhookHeader[]
  body: string
}

export type DeliveryError = {
  message?: string
  [key: string]: unknown
}

export type WebhookDelivery = {
  id: string
  webhookId: string
  success: boolean
  events: string
  request?: DeliveryRequest | null
  response?: DeliveryResponse | null
  error?: DeliveryError | null
  startedAt: string
  endedAt: string
}

export type PagedWebhookDeliveries = {
  totalCount: number
  items: WebhookDelivery[]
}

export type WebhookTestRequest = {
  id: string
  deliveryId: string
  url: string
  name: string
  secret: string
  headers: WebhookHeader[]
  events: string
  payload: string
  preventEmptyPayloads: boolean
}

export type EnvironmentResource = {
  id: string
  name: string
  pathName: string
  rn: string
  type: string
}

export type WebhookSheetMode = "new" | "edit" | "view"

export type WebhookDraft = {
  name: string
  url: string
  isActive: boolean
  environmentIds: string[]
  events: string[]
  headers: WebhookHeader[]
  payloadTemplateType: "default" | "custom"
  payloadTemplate: string
  secret: string
  preventEmptyPayloads: boolean
}
