import type { ComponentProps } from "react"
import { Link } from "react-router-dom"
import { useDetailHref, useListDetailHref } from "@/lib/list-navigation"

type Props = Omit<ComponentProps<typeof Link>, "to"> & { to: string }

export function ListDetailLink({ to, ...props }: Props) {
  const detailHref = useListDetailHref()
  return <Link {...props} to={detailHref(to)} />
}

export function DetailTabLink({ to, ...props }: Props) {
  const detailHref = useDetailHref()
  return <Link {...props} to={detailHref(to)} />
}
