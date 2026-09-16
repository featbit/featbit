export const auditModules = [
  "metric",
  "connection",
  "sourceBinding",
  "monitor",
] as const
export type AuditModule = (typeof auditModules)[number]
export type AuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "tested"
  | "validated"
  | "credentialRotated"
  | "contractUpdated"
  | "ruleUpdated"
  | "paused"
  | "resumed"
  | "metricUnbound"
export type AuditChange = {
  field: string
  before: string | null
  after: string | null
}
export type ReleaseHealthAuditLog = {
  id: string
  occurredAt: string
  module: AuditModule
  action: AuditAction
  object: { name: string; key: string }
  actor: { name: string; kind: "user" | "service" }
  source: "UI" | "API"
  scope: "project" | "environment"
  result: "succeeded" | "failed"
  changes: AuditChange[]
  note?: "connectionTimeout" | "validationPassed"
}

const actors = {
  mia: { name: "Mia Chen", kind: "user" },
  kai: { name: "Kai Morgan", kind: "user" },
  bot: { name: "release-automation", kind: "service" },
} as const
const objects = {
  latency: { name: "Checkout P95 latency", key: "checkout_p95_latency" },
  errors: { name: "Checkout error rate", key: "checkout_error_rate" },
  legacy: { name: "Legacy checkout latency", key: "legacy_checkout_latency" },
  primary: { name: "Production Prometheus", key: "prometheus-primary" },
  legacyConnection: { name: "Legacy Prometheus", key: "prometheus-legacy" },
  monitor: {
    name: "Checkout reliability",
    key: "checkout-redesign / reliability",
  },
} as const

function change(
  field: string,
  before: string | null,
  after: string | null
): AuditChange {
  return { field, before, after }
}
function sample(
  module: AuditModule,
  action: AuditAction,
  object: keyof typeof objects,
  actor: keyof typeof actors,
  changes: AuditChange[],
  options: Pick<ReleaseHealthAuditLog, "result" | "note"> = {
    result: "succeeded",
  }
): Omit<ReleaseHealthAuditLog, "id" | "occurredAt"> {
  return {
    module,
    action,
    object: objects[object],
    actor: actors[actor],
    source: actors[actor].kind === "service" ? "API" : "UI",
    scope: module === "metric" ? "project" : "environment",
    changes,
    ...options,
  }
}

// Deliberately separate from live Metric changes and platform audit APIs.
const samples = [
  sample("sourceBinding", "updated", "latency", "mia", [
    change("step", "15m", "1m"),
  ]),
  sample("monitor", "ruleUpdated", "monitor", "kai", [
    change("threshold", "> 2%", "> 1%"),
    change("window", "5m", "10m"),
  ]),
  sample("connection", "tested", "primary", "kai", [], {
    result: "failed",
    note: "connectionTimeout",
  }),
  sample("metric", "updated", "latency", "mia", [
    change("description", null, "95th percentile checkout response time."),
  ]),
  sample("sourceBinding", "validated", "errors", "mia", [], {
    result: "succeeded",
    note: "validationPassed",
  }),
  sample("monitor", "resumed", "monitor", "kai", [
    change("monitoring", "Paused", "Enabled"),
  ]),
  sample("connection", "credentialRotated", "primary", "mia", [
    change("credential", "Configured", "Replaced"),
  ]),
  sample("metric", "contractUpdated", "errors", "bot", [
    change("maximum", "100", "80"),
  ]),
  sample("monitor", "paused", "monitor", "kai", [
    change("monitoring", "Enabled", "Paused"),
  ]),
  sample("sourceBinding", "created", "latency", "mia", [
    change("connection", null, "Production Prometheus"),
    change("step", null, "15m"),
  ]),
  sample("connection", "updated", "primary", "mia", [
    change("name", "Prometheus primary", "Production Prometheus"),
  ]),
  sample("monitor", "metricUnbound", "monitor", "bot", [
    change("metricBinding", "legacy_checkout_latency", null),
  ]),
  sample("metric", "created", "latency", "mia", [
    change("name", null, "Checkout P95 latency"),
    change("unit", null, "millisecond"),
  ]),
  sample("connection", "created", "primary", "mia", [
    change("provider", null, "Prometheus-compatible"),
    change("authentication", null, "Bearer token"),
  ]),
  sample("sourceBinding", "updated", "errors", "bot", [
    change("query", "q:47ab", "q:93de"),
  ]),
  sample("monitor", "created", "monitor", "kai", [
    change("monitoring", null, "Enabled"),
    change("threshold", null, "> 2%"),
  ]),
  sample("metric", "updated", "errors", "mia", [
    change("category", "Quality", "Reliability"),
  ]),
  sample("sourceBinding", "deleted", "legacy", "bot", [
    change("connection", "Legacy Prometheus", null),
  ]),
  sample("connection", "deleted", "legacyConnection", "kai", [
    change("name", "Legacy Prometheus", null),
  ]),
  sample("metric", "created", "errors", "mia", [
    change("name", null, "Checkout error rate"),
    change("unit", null, "percent (0–100)"),
  ]),
]

export function createAuditLogSamples(now: number): ReleaseHealthAuditLog[] {
  return samples.map((entry, index) => ({
    ...entry,
    id: `rh-demo-${String(index + 1).padStart(3, "0")}`,
    occurredAt: new Date(now - (index * 37 + 3) * 60_000).toISOString(),
  }))
}
