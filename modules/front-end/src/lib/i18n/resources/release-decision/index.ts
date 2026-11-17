import { enExperiments, zhExperiments } from "./experiments"
import { enLayers, zhLayers } from "./layers"
import { enMetrics, zhMetrics } from "./metrics"

export const enReleaseDecision = {
  experiments: enExperiments,
  metrics: enMetrics,
  layers: enLayers,
} as const

export const zhReleaseDecision = {
  experiments: zhExperiments,
  metrics: zhMetrics,
  layers: zhLayers,
} as const
