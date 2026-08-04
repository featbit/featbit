import { useTranslation } from "react-i18next"
import { Card, CardContent } from "@/components/ui/card"

export function LayoutPlaceholder() {
  const { t } = useTranslation()

  return (
    <Card className="h-full border-dashed bg-card/50 shadow-none">
      <CardContent className="flex h-full min-h-[24rem] items-center justify-center p-6 text-sm text-muted-foreground">
        {t("layout.placeholder")}
      </CardContent>
    </Card>
  )
}
