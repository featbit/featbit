import type { ReactNode } from "react"
import type { To } from "react-router-dom"
import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"

export function DetailBackLink({
  to,
  children,
}: {
  to: To
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      {children}
    </Link>
  )
}
