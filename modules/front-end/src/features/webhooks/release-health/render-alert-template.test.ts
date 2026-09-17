import { describe, expect, it } from "vitest"
import { renderAlertTemplate } from "./render-alert-template"

function payload(template: string, context: unknown) {
  return JSON.parse(renderAlertTemplate(template, context))
}

describe("direct JSON template variables", () => {
  const context = {
    metric: {
      name: 'Checkout "errors" \\ API\n<test> & 中文',
      tags: ["one", 'two"'],
    },
    evaluation: { value: 2.6, ready: true },
    alert: { recoveredAt: null },
  }

  it("preserves numbers, booleans, null, arrays and objects without a helper", () => {
    expect(
      payload(
        `{
      "value": {{evaluation.value}},
      "ready": {{evaluation.ready}},
      "recoveredAt": {{alert.recoveredAt}},
      "tags": {{metric.tags}},
      "metric": {{metric}}
    }`,
        context
      )
    ).toEqual({
      value: 2.6,
      ready: true,
      recoveredAt: null,
      tags: context.metric.tags,
      metric: context.metric,
    })
  })

  it("escapes quoted strings and interpolated messages without HTML entities or type coercion", () => {
    expect(
      payload(
        `{
      "name": "{{metric.name}}",
      "raw": {{metric.name}},
      "message": "Metric {{metric.name}}: {{evaluation.value}}%",
      "textValue": "{{evaluation.value}}"
    }`,
        context
      )
    ).toEqual({
      name: context.metric.name,
      raw: context.metric.name,
      message: `Metric ${context.metric.name}: 2.6%`,
      textValue: "2.6",
    })
    const injection = '\\", "injected": true, "unused": "'
    expect(payload('{"name": "{{name}}"}', { name: injection })).toEqual({
      name: injection,
    })
  })

  it("resolves quote context after conditional branches and supports existing eq blocks", () => {
    const template = `{"result": {{#if quote}}"{{/if}}{{value}}{{#if quote}}"{{/if}} }`
    expect(payload(template, { quote: true, value: 2.6 })).toEqual({
      result: "2.6",
    })
    expect(payload(template, { quote: false, value: 2.6 })).toEqual({
      result: 2.6,
    })
    const recovered = `{"result": {{#eq type "recovered"}}{{value}}{{else}}null{{/eq}} }`
    expect(
      payload(recovered, { type: "recovered", value: "2026-09-17T02:20:00Z" })
    ).toEqual({ result: "2026-09-17T02:20:00Z" })
    expect(payload(recovered, { type: "triggered", value: "unused" })).toEqual({
      result: null,
    })
  })

  it("supports loops and computed fields while retaining explicit json helpers", () => {
    expect(
      payload(
        `{
      "items": [{{#each metric.tags}}{{this}}{{#unless @last}},{{/unless}}{{/each}}],
      "computed": {{lookup evaluation "value"}},
      "legacy": {{json metric}},
      "direct": {{metric}}
    }`,
        context
      )
    ).toEqual({
      items: context.metric.tags,
      computed: 2.6,
      legacy: context.metric,
      direct: context.metric,
    })
  })

  it("does not re-evaluate template syntax within data and rejects missing fields", () => {
    const name = "{{evaluation.value}} {{json metric}}"
    expect(payload('{"name": "{{name}}"}', { name })).toEqual({ name })
    expect(() =>
      payload('{"value": {{evaluation.missing}} }', context)
    ).toThrow("missing")
    expect(payload('{"name": "\\{{metric.name}}"}', context)).toEqual({
      name: "{{metric.name}}",
    })
  })
})
