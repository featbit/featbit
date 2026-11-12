import { useCallback } from "react"
import {
  useLocation,
  useNavigate,
  type NavigateOptions,
} from "react-router-dom"
import { getCurrentProjectEnv } from "@/features/layout/layout-context"

const listPath =
  /^\/(en|zh)\/(feature-flags(?:\/compare)?|segments|experiments|iam\/(team|groups|policies)|access-tokens|relay-proxies|webhooks|end-users|workspace\/global-users|metrics|layers)$/

export function listReturnUrl(search: string, fallback: string) {
  const candidate = new URLSearchParams(search).get("returnTo")
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\")
  )
    return fallback
  try {
    const url = new URL(candidate, "https://featbit.invalid")
    if (
      url.origin !== "https://featbit.invalid" ||
      !listPath.test(url.pathname)
    )
      return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

export function withListReturn(href: string, returnTo: string) {
  const url = new URL(href, "https://featbit.invalid")
  url.searchParams.set("returnTo", returnTo)
  return `${url.pathname}${url.search}${url.hash}`
}

export function useListReturnUrl(fallback: string) {
  return listReturnUrl(useLocation().search, fallback)
}

export function useListDetailHref() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  // Compare links can open another environment in a new tab. Return to the
  // source environment as well as to its filters and pagination.
  const projectEnv = getCurrentProjectEnv()
  if (location.pathname.endsWith("/feature-flags/compare") && projectEnv) {
    params.set("context", "environment")
    params.set("projectId", projectEnv.projectId)
    params.set("envId", projectEnv.envId)
  }
  const query = params.toString()
  const source = `${location.pathname}${query ? `?${query}` : ""}${location.hash}`
  const isList = listPath.test(location.pathname)
  return useCallback(
    (href: string) => (isList ? withListReturn(href, source) : href),
    [source, isList]
  )
}

export function useListNavigate() {
  const navigate = useNavigate()
  const detailHref = useListDetailHref()
  return useCallback(
    (href: string, options?: NavigateOptions) =>
      navigate(detailHref(href), options),
    [navigate, detailHref]
  )
}

export function useDetailHref() {
  const { search } = useLocation()
  const returnTo = listReturnUrl(search, "")
  return useCallback(
    (href: string) => (returnTo ? withListReturn(href, returnTo) : href),
    [returnTo]
  )
}

// Preserve the origin while moving between detail tabs, including canonical redirects.
export function useDetailNavigate(fallback: string) {
  const navigate = useNavigate()
  const returnUrl = useListReturnUrl(fallback)
  const detailHref = useDetailHref()
  return useCallback(
    (href: string, options?: NavigateOptions) => {
      return navigate(href === fallback ? returnUrl : detailHref(href), options)
    },
    [navigate, fallback, returnUrl, detailHref]
  )
}
