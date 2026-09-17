import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { Activity, GitBranch } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ResourceWebhooksContent } from "./resource-webhooks-content"
import { ReleaseHealthWebhooksContent } from "./release-health/release-health-webhooks-content"
import { previewStoreKey } from "./release-health/preview-store"

export function WebhooksPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const category =
    params.get("category") === "release-health"
      ? "release-health"
      : "resource-changes"
  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-normal">
          {t("webhooks.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("webhooks.subtitle")}
        </p>
      </header>
      <Tabs
        value={category}
        onValueChange={(value) => {
          const next = new URLSearchParams(params)
          next.set("category", String(value))
          next.delete("create")
          setParams(next)
        }}
      >
        <div className="mb-5 border-b">
          <TabsList variant="line" className="h-10 gap-5">
            <TabsTrigger value="resource-changes">
              <GitBranch />
              {t("webhooks.tabs.resourceChanges")}
            </TabsTrigger>
            <TabsTrigger value="release-health">
              <Activity />
              Release Health
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="resource-changes">
          <ResourceWebhooksContent />
        </TabsContent>
        <TabsContent value="release-health">
          <ReleaseHealthWebhooksContent key={previewStoreKey()} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
