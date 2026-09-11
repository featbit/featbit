import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { fetchMetrics } from "@/features/expt-metrics/metrics-api"
import type { Metric } from "@/features/expt-metrics/metrics-types"
import { ExperimentMetricsSheet } from "./experiment-metrics-sheet"
import { parseGuardrails, parsePrimaryMetric } from "./exposure-utils"

vi.mock("@/features/expt-metrics/metrics-api", () => ({
  fetchMetrics: vi.fn(),
}))

beforeEach(() => vi.clearAllMocks())

describe("editing experiment metrics", () => {
  it.each([false, true])(
    "restores saved selections outside the first catalog page (saved IDs: %s)",
    async (withIds) => {
      const primary = parsePrimaryMetric(
        JSON.stringify({
          metricId: withIds ? "primary-id" : undefined,
          name: "Checkout latency",
          event: "checkout-latency",
          metricType: "numeric",
          metricAgg: "average",
          expectedDirection: "decrease_good",
        })
      )
      const guardrails = parseGuardrails(
        JSON.stringify([
          {
            metricId: withIds ? "guardrail-id" : undefined,
            name: "Error rate",
            event: "checkout-errors",
            metricType: "binary",
            metricAgg: "once",
            direction: "increase_bad",
          },
        ])
      )
      const firstPage: Metric[] = Array.from({ length: 10 }, (_, index) => ({
        id: `metric-${index}`,
        key: `other-metric-${index}`,
        name: `Other metric ${index}`,
        featBitEnvId: "env-1",
        metricType: "binary",
        metricAgg: "once",
        status: "active",
        createdAt: "2026-09-10T00:00:00Z",
        updatedAt: "2026-09-10T00:00:00Z",
      }))
      vi.mocked(fetchMetrics).mockResolvedValue({
        items: firstPage,
        totalCount: 12,
      })
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
      const onConfirm = vi.fn().mockResolvedValue(undefined)
      render(
        <QueryClientProvider client={queryClient}>
          <ExperimentMetricsSheet
            open
            envId="env-1"
            primary={primary}
            guardrails={guardrails}
            saving={false}
            saveError={false}
            onOpenChange={vi.fn()}
            onConfirm={onConfirm}
          />
        </QueryClientProvider>
      )

      expect(
        await screen.findByRole("button", {
          name: "Checkout latency (checkout-latency)",
        })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: "Error rate (checkout-errors)" })
      ).toBeInTheDocument()
      expect(screen.getByText("Lower is better")).toBeInTheDocument()
      expect(screen.queryByText("Select metric")).not.toBeInTheDocument()
      const save = screen.getByRole("button", { name: "Save metrics" })
      expect(save).toBeEnabled()
      fireEvent.click(save)

      const payload = JSON.parse(JSON.stringify(onConfirm.mock.calls[0][0]))
      expect(payload).toEqual({
        ...(withIds ? { metricId: "primary-id" } : {}),
        metricKey: "checkout-latency",
        expectedDirection: "decrease_good",
        guardrails: JSON.stringify([
          {
            ...(withIds ? { metricId: "guardrail-id" } : {}),
            metricKey: "checkout-errors",
            direction: "increase_bad",
          },
        ]),
      })
      expect(fetchMetrics).toHaveBeenCalledWith("env-1", {
        search: "",
        status: "active",
        pageIndex: 0,
        pageSize: 10,
      })
      queryClient.clear()
    }
  )
})
