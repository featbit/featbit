import {
  availableAlertWebhooks,
  useReleaseHealthWebhooks,
} from "@/features/webhooks/release-health/preview-store"

export type BindingWebhook = { id: string; name: string; url: string }

export function useBindingWebhooks(projectId: string, envId: string) {
  return useReleaseHealthWebhooks((items): BindingWebhook[] =>
    availableAlertWebhooks(items, projectId, envId).map(
      ({ id, name, url }) => ({ id, name, url })
    )
  )
}
