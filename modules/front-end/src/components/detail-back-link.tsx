import type { ComponentProps } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"

export function DetailBackLink({
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, "className">) {
  return (
    <Link
      {...props}
      className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      {children}
    </Link>
  )
}
