import { useCallback, useEffect, useState } from "react"
import {
  fetchMemberPermissions,
  type MemberPermission,
} from "../permissions-api"

export function useMemberPermissions(memberId: string) {
  const [items, setItems] = useState<MemberPermission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    if (!memberId) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(false)
    fetchMemberPermissions(memberId)
      .then(setItems)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [memberId])

  useEffect(() => {
    const timeout = window.setTimeout(load, 0)
    return () => window.clearTimeout(timeout)
  }, [load])

  return { items, loading, error, reload: load }
}
