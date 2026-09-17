import {
  ALERT_SAMPLE_CASES,
  DEFAULT_ALERT_SAMPLE,
  type AlertSampleOptions,
} from "./alert-contract-samples"
import {
  ALERT_EVENTS,
  alertPayloadSample,
  alertSampleDescription,
  type AlertEvent,
} from "./alert-event-catalog"
import {
  compileAlertTemplate,
  renderAlertTemplate,
} from "./render-alert-template"

export {
  ALERT_EVENTS,
  alertPayloadSample,
  type AlertEvent,
} from "./alert-event-catalog"
export {
  ALERT_PAYLOAD_TEMPLATE,
  ALERT_TEMPLATE_GROUPS,
  ALERT_TEMPLATE_VARIABLES,
} from "./alert-template-schema"

function formattedPayload(rendered: string) {
  const payload: unknown = JSON.parse(rendered)
  if (payload === null || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("The payload must be a JSON object.")
  return JSON.stringify(payload, null, 2)
}

export function renderAlertPayload(
  template: string,
  event: AlertEvent,
  sample: AlertSampleOptions = DEFAULT_ALERT_SAMPLE
) {
  return formattedPayload(
    renderAlertTemplate(template, alertPayloadSample(event, sample))
  )
}

export function validateAlertTemplate(template: string): string | null {
  try {
    const render = compileAlertTemplate(template)
    for (const sample of ALERT_SAMPLE_CASES) {
      for (const event of ALERT_EVENTS) {
        try {
          formattedPayload(render(alertPayloadSample(event, sample)))
        } catch (error) {
          return `${event} · ${alertSampleDescription(sample)}: ${error instanceof Error ? error.message : "Invalid JSON template"}`
        }
      }
    }
    return null
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid JSON template"
  }
}
