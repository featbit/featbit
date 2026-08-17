import { Info, LockKeyhole, Shield } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function LicenseGateCard({
  title,
  description,
  actionLabel,
  actionHref,
  note,
}: {
  title: string
  description: string
  actionLabel: string
  actionHref: string
  note: string
}) {
  return (
    <Card className="min-h-[clamp(30rem,66vh,39rem)] gap-0 bg-background py-0 shadow-none">
      <CardContent className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
        <div className="flex max-w-xl -translate-y-8 flex-col items-center text-center">
          <div className="relative flex size-16 items-center justify-center rounded-xl border bg-muted/40 text-foreground">
            <Shield aria-hidden className="size-9 stroke-[1.5]" />
            <LockKeyhole
              aria-hidden
              className="absolute size-3.5 translate-y-0.5 stroke-[2.25]"
            />
          </div>

          <h2 className="mt-8 text-xl font-semibold tracking-normal">
            {title}
          </h2>
          <p className="mt-3 max-w-[65ch] text-sm leading-6 text-muted-foreground">
            {description}
          </p>

          <Button
            nativeButton={false}
            className="mt-7 min-w-36"
            render={<Link to={actionHref} />}
          >
            {actionLabel}
          </Button>

          <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <Info aria-hidden className="size-4 shrink-0" />
            <span>{note}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
