import type { FeatureFlag } from "@/features/flags/flags-types"

export function matchesFlagKey(flag: Pick<FeatureFlag, "key">, search: string) {
  return flag.key
    .toLocaleLowerCase()
    .includes(search.trim().toLocaleLowerCase())
}
