import type {
  AnalysisRow,
  AnalysisSection,
  MeasuringRun,
  ParsedAnalysis,
  AudienceFilter,
} from "./measuring-types"

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function parseObject(value: string | null | undefined) {
  if (!value?.trim()) return null
  try {
    return objectValue(JSON.parse(value))
  } catch {
    return null
  }
}

export function parseExperimentVariantNames(
  value: string | null | undefined
): Record<string, string> {
  if (!value?.trim()) return {}
  try {
    const variants: unknown = JSON.parse(value)
    if (!Array.isArray(variants)) return {}

    return Object.fromEntries(
      variants.flatMap((item) => {
        const variant = objectValue(item)
        const name = stringValue(variant?.name)
        if (!variant || !name) return []

        return [variant.key, variant.name, variant.value].flatMap((token) => {
          const normalized = stringValue(token)
          return normalized ? [[normalized, name] as const] : []
        })
      })
    )
  } catch {
    return {}
  }
}

function numberMap(value: unknown) {
  const source = objectValue(value)
  if (!source) return {}
  return Object.fromEntries(
    Object.entries(source).flatMap(([key, item]) => {
      const number = numberValue(item)
      return number === undefined ? [] : [[key, number]]
    })
  )
}

function analysisRow(value: unknown): AnalysisRow | null {
  const row = objectValue(value)
  const variant = stringValue(row?.variant ?? row?.arm)
  if (!row || !variant) return null
  const pWin = numberValue(row.p_win)
  const pHarm = numberValue(row.p_harm)
  return {
    variant,
    n: numberValue(row.n) ?? 0,
    conversions: numberValue(row.conversions),
    rate: numberValue(row.rate),
    mean: numberValue(row.mean),
    relDelta: numberValue(row.rel_delta),
    ciLower: numberValue(row.ci_lower),
    ciUpper: numberValue(row.ci_upper),
    signalLabel:
      pHarm !== undefined ? "pHarm" : pWin !== undefined ? "pWin" : undefined,
    signal: pHarm ?? pWin,
  }
}

function section(value: unknown): AnalysisSection | undefined {
  const source = objectValue(value)
  if (!source) return undefined
  const rows = Array.isArray(source.rows)
    ? source.rows
        .map(analysisRow)
        .filter((row): row is AnalysisRow => Boolean(row))
    : []
  return {
    label: stringValue(source.label) ?? stringValue(source.metric) ?? "",
    rows,
    verdict: stringValue(source.verdict),
  }
}

export function parseAnalysis(
  value: string | null | undefined
): ParsedAnalysis {
  const source = parseObject(value)
  if (!source) return { type: "unknown", guardrails: [] }
  const rawType = stringValue(source.type)
  const srm = objectValue(source.srm)
  const sample = objectValue(source.sample_check)
  const thompson = objectValue(source.thompson_sampling)
  const stopping = objectValue(source.stopping)
  const banditRows = Array.isArray(source.arms)
    ? source.arms
        .map(analysisRow)
        .filter((row): row is AnalysisRow => Boolean(row))
    : []
  const recommendations = Array.isArray(thompson?.results)
    ? new Map(
        thompson.results.flatMap((item) => {
          const result = objectValue(item)
          const arm = stringValue(result?.arm)
          return arm ? [[arm, result] as const] : []
        })
      )
    : new Map<string, Record<string, unknown>>()

  banditRows.forEach((row) => {
    const recommendation = recommendations.get(row.variant)
    row.pBest = numberValue(recommendation?.p_best)
    row.recommendedWeight = numberValue(recommendation?.recommended_weight)
  })

  const guardrails = Array.isArray(source.guardrails)
    ? source.guardrails
        .map(section)
        .filter((item): item is AnalysisSection => Boolean(item))
    : []

  return {
    type: rawType === "bandit" || rawType === "bayesian" ? rawType : "unknown",
    computedAt: stringValue(source.computed_at),
    algorithm: stringValue(source.algorithm),
    prior: stringValue(source.prior),
    srm: srm
      ? {
          pValue: numberValue(srm.chi2_p_value),
          ok: typeof srm.ok === "boolean" ? srm.ok : undefined,
          observed: numberMap(srm.observed),
        }
      : undefined,
    sampleCheck: sample
      ? {
          minimum: numberValue(sample.minimum_per_variant) ?? 0,
          ok: sample.ok === true,
          variants: numberMap(sample.variants),
        }
      : undefined,
    primary:
      rawType === "bandit"
        ? { label: stringValue(source.metric) ?? "", rows: banditRows }
        : section(source.primary_metric),
    guardrails,
    enoughUnits:
      typeof thompson?.enough_units === "boolean"
        ? thompson.enough_units
        : undefined,
    stopping: stopping
      ? {
          met: typeof stopping.met === "boolean" ? stopping.met : undefined,
          threshold: numberValue(stopping.threshold),
          message: stringValue(stopping.message),
        }
      : undefined,
  }
}

export function orderedRuns(runs: MeasuringRun[]) {
  return [...runs].sort((left, right) => {
    const created = left.createdAt.localeCompare(right.createdAt)
    return created || left.id.localeCompare(right.id)
  })
}

export function runVariants(run: MeasuringRun) {
  const control = run.controlVariant?.trim() ?? ""
  const treatments = (run.treatmentVariant ?? "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
  return [control, ...treatments].filter(Boolean)
}

export function parseSamplingPlan(run: MeasuringRun) {
  const fallback = Object.fromEntries(
    runVariants(run).map((variant) => [variant, 100])
  )
  if (!run.analysisSamplingPlan?.trim()) return fallback
  try {
    const parsed = JSON.parse(run.analysisSamplingPlan)
    if (!Array.isArray(parsed)) return fallback
    const rates = Object.fromEntries(
      parsed.flatMap((item) => {
        const entry = objectValue(item)
        const variation = stringValue(entry?.variation)
        if (!variation) return []
        return [
          [
            variation,
            Math.min(100, Math.max(0, numberValue(entry?.includeRate) ?? 100)),
          ],
        ]
      })
    )
    return { ...fallback, ...rates }
  } catch {
    return fallback
  }
}

export function serializeSamplingPlan(
  baseline: string,
  arms: string[],
  rates: Record<string, number>,
  labels: Record<string, string>
) {
  return JSON.stringify(
    [baseline, ...arms].filter(Boolean).map((variation, index) => ({
      variation,
      role: index === 0 ? "control" : "treatment",
      includeRate: Math.min(100, Math.max(0, rates[variation] ?? 100)),
      label: labels[variation] ?? variation,
    }))
  )
}

export function parseAudienceFilters(
  value: string | null | undefined
): AudienceFilter[] {
  if (!value?.trim()) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      const entry = objectValue(item)
      const property = stringValue(entry?.property)
      if (!property) return []
      const rawOp = stringValue(entry?.op)
      const op: AudienceFilter["op"] =
        rawOp === "neq" || rawOp === "in" || rawOp === "nin" ? rawOp : "eq"
      const rawValues = Array.isArray(entry?.values)
        ? entry.values
            .filter((value): value is string => typeof value === "string")
            .join(", ")
        : (stringValue(entry?.value) ?? "")
      return [{ property, op, value: rawValues }]
    })
  } catch {
    return []
  }
}

export function serializeAudienceFilters(filters: AudienceFilter[]) {
  const entries: Array<
    | { property: string; op: "eq" | "neq"; value: string }
    | { property: string; op: "in" | "nin"; values: string[] }
  > = []
  filters.forEach((filter) => {
    const property = filter.property.trim()
    if (!property) return
    if (filter.op === "in" || filter.op === "nin") {
      entries.push({
        property,
        op: filter.op,
        values: filter.value
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      })
      return
    }
    entries.push({ property, op: filter.op, value: filter.value.trim() })
  })
  return JSON.stringify(entries)
}

export function normalizedMethod(method: string | null | undefined) {
  return method?.trim().toLowerCase() === "bandit" ? "bandit" : "bayesian_ab"
}

export function normalizedDecision(decision: string | null | undefined) {
  return (
    decision?.trim().toUpperCase().replaceAll("_", " ").replaceAll("-", " ") ??
    ""
  )
}

export function formatPercent(value: number | undefined) {
  return value === undefined
    ? "—"
    : `${(value * 100).toFixed(value === 0 ? 0 : 1)}%`
}
