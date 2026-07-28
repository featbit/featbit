import type { FeatureFlag, FlagTargeting, FlagVariation } from "../flags-types"

export function withFlagTargeting(
  flag: FeatureFlag,
  targeting: FlagTargeting,
  revision = flag.revision
): FeatureFlag {
  return {
    ...structuredClone(flag),
    ...structuredClone(targeting),
    revision,
  }
}

export function withFlagVariations(
  flag: FeatureFlag,
  variations: FlagVariation[],
  revision = flag.revision
): FeatureFlag {
  return {
    ...structuredClone(flag),
    variations: structuredClone(variations),
    revision,
  }
}
