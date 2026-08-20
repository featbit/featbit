import { Info, RefreshCw, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type RetryAction = {
  label: string
  pendingLabel: string
  pending: boolean
  onRetry: () => void
}

export function UnavailablePage({
  pageTitle,
  pageSubtitle,
  icon: Icon,
  title,
  description,
  note,
  retry,
}: {
  pageTitle: string
  pageSubtitle: string
  icon: LucideIcon
  title: string
  description: string
  note?: string
  retry?: RetryAction
}) {
  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-6 py-6 lg:px-8">
      <header className="mb-10 space-y-1">
        <h1 className="text-2xl font-semibold tracking-normal">{pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{pageSubtitle}</p>
      </header>

      <Card className="min-h-[clamp(30rem,66vh,39rem)] gap-0 bg-background py-0 shadow-none">
        <CardContent className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
          <div className="flex max-w-xl -translate-y-8 flex-col items-center text-center">
            <div className="flex size-16 items-center justify-center rounded-xl border bg-muted/40 text-foreground">
              <Icon aria-hidden className="size-9 stroke-[1.5]" />
            </div>

            <h2 className="mt-8 text-xl font-semibold tracking-normal">
              {title}
            </h2>
            <p className="mt-3 max-w-[65ch] text-sm leading-6 text-muted-foreground">
              {description}
            </p>

            {note ? (
              <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                <Info aria-hidden className="size-4 shrink-0" />
                <span>{note}</span>
              </p>
            ) : null}

            {retry ? (
              <Button
                className="mt-7 min-w-28"
                disabled={retry.pending}
                onClick={retry.onRetry}
              >
                <RefreshCw
                  aria-hidden
                  className={retry.pending ? "animate-spin" : undefined}
                />
                {retry.pending ? retry.pendingLabel : retry.label}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
