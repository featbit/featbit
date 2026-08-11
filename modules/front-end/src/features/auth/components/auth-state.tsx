import { ArrowLeft, RefreshCw, Shield, TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { Lang } from "@/features/auth/auth-page-types"
import { cn } from "@/lib/utils"

export function AuthProcessState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mx-auto flex min-h-[420px] w-full max-w-[480px] flex-col justify-center px-6 pb-8 sm:px-10 2xl:min-h-[520px] 2xl:px-0">
      <div role="status" aria-live="polite">
        <span className="flex size-10 items-center justify-center rounded-lg border bg-muted/50 text-muted-foreground">
          <Shield className="size-5" />
        </span>
        <h2 className="mt-6 text-3xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-3 max-w-md text-base text-muted-foreground">
          {description}
        </p>
        <div className="mt-8 space-y-3" aria-hidden="true">
          <Skeleton className="h-12 w-full motion-reduce:animate-none" />
          <Skeleton className="h-12 w-3/4 motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  )
}

export function SsoCheckErrorState({
  lang,
  isRetrying,
  onRetry,
}: {
  lang: Lang
  isRetrying: boolean
  onRetry: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col justify-start px-6 pb-8 sm:px-10 2xl:min-h-[520px] 2xl:px-0">
      <Button
        type="button"
        variant="link"
        className="mb-14 h-auto justify-start gap-3 p-0 text-base"
        onClick={() => navigate(`/${lang}/login`, { replace: true })}
      >
        <ArrowLeft className="size-5" />
        {t("auth.backToSignIn")}
      </Button>

      <TriangleAlert className="size-8 text-muted-foreground" />
      <h2 className="mt-5 text-3xl font-semibold tracking-tight">
        {t("auth.sso.checkFailedTitle")}
      </h2>
      <p className="mt-3 max-w-md text-base text-muted-foreground">
        {t("auth.sso.checkFailedDescription")}
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-8 h-12 w-full gap-3 text-base"
        disabled={isRetrying}
        onClick={onRetry}
      >
        <RefreshCw
          className={cn(
            "size-5",
            isRetrying && "animate-spin motion-reduce:animate-none"
          )}
        />
        {isRetrying ? t("auth.retrying") : t("auth.retry")}
      </Button>
    </div>
  )
}
