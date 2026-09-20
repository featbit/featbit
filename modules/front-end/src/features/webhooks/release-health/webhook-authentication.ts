import { z } from "zod"

export const webhookHeadersSchema = z
  .array(
    z.object({
      key: z.string().trim(),
      value: z.string(),
    })
  )
  .superRefine((headers, context) => {
    const names = new Set<string>()
    headers.forEach((header, index) => {
      if (!header.key && !header.value) return
      if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(header.key)) {
        context.addIssue({
          code: "custom",
          path: [index, "key"],
          message: "webhooks.releaseHealth.headerNameInvalid",
        })
      }
      const name = header.key.toLowerCase()
      if (names.has(name)) {
        context.addIssue({
          code: "custom",
          path: [index, "key"],
          message: "webhooks.releaseHealth.headerDuplicate",
        })
      }
      names.add(name)
      if (/[\r\n\0]/.test(header.value)) {
        context.addIssue({
          code: "custom",
          path: [index, "value"],
          message: "webhooks.releaseHealth.headerValueInvalid",
        })
      }
    })
  })

export type WebhookAuthentication = {
  headers: z.infer<typeof webhookHeadersSchema>
  secret: string
}
