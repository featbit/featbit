import type { ComponentProps } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { useListReturnUrl } from "@/lib/list-navigation"

export function DetailBackLink({
  children,
  to,
  ...props
}: Omit<ComponentProps<typeof Link>, "className">) {
  const returnUrl = useListReturnUrl(typeof to === "string" ? to : "")
  return (
    <Link
      {...props}
      to={returnUrl || to}
      className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      {children}
    </Link>
  )
}
