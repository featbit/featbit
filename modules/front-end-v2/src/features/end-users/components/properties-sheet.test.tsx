import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { upsertEndUserProperty } from "../end-users-api"
import type { EndUserProperty } from "../end-users-types"
import { PropertiesSheet } from "./properties-sheet"

vi.mock("../end-users-api", () => ({
  upsertEndUserProperty: vi.fn(),
  removeEndUserProperty: vi.fn(),
}))

const properties: EndUserProperty[] = [
  {
    id: "property-plan",
    name: "plan",
    remark: "",
    isBuiltIn: false,
    isDigestField: false,
    presetValues: [],
    usePresetValuesOnly: false,
  },
  {
    id: "property-country",
    name: "country",
    remark: "",
    isBuiltIn: false,
    isDigestField: false,
    presetValues: [],
    usePresetValuesOnly: false,
  },
]

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, reject, resolve }
}

function renderSheet() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  queryClient.setQueryData(["end-users", "env-1", "properties"], properties)

  const view = render(
    <QueryClientProvider client={queryClient}>
      <PropertiesSheet
        envId="env-1"
        open
        properties={properties}
        loading={false}
        error={false}
        onRetry={vi.fn()}
        onOpenChange={vi.fn()}
      />
    </QueryClientProvider>
  )

  return { ...view, queryClient }
}

describe("PropertiesSheet digest fields", () => {
  beforeEach(() => {
    vi.mocked(upsertEndUserProperty).mockReset()
  })

  it("checks a digest field immediately without disabling any custom fields", async () => {
    vi.mocked(upsertEndUserProperty).mockReturnValue(new Promise(() => {}))
    renderSheet()

    const [planDigest, countryDigest] = screen.getAllByRole("checkbox")
    fireEvent.click(planDigest)

    await waitFor(() =>
      expect(planDigest).toHaveAttribute("aria-checked", "true")
    )
    expect(planDigest).not.toHaveAttribute("aria-disabled", "true")
    expect(countryDigest).not.toHaveAttribute("aria-disabled", "true")
  })

  it("rolls the optimistic digest value back when saving fails", async () => {
    vi.mocked(upsertEndUserProperty).mockRejectedValue(new Error("failed"))
    renderSheet()

    const [planDigest] = screen.getAllByRole("checkbox")
    fireEvent.click(planDigest)

    expect(planDigest).toHaveAttribute("aria-checked", "true")
    await waitFor(() =>
      expect(planDigest).toHaveAttribute("aria-checked", "false")
    )
  })

  it("serializes overlapping digest updates and preserves the latest selection", async () => {
    const firstSave = deferred<EndUserProperty>()
    const secondSave = deferred<EndUserProperty>()
    vi.mocked(upsertEndUserProperty)
      .mockReturnValueOnce(firstSave.promise)
      .mockReturnValueOnce(secondSave.promise)
    const { queryClient } = renderSheet()

    const [planDigest] = screen.getAllByRole("checkbox")
    fireEvent.click(planDigest)
    fireEvent.click(planDigest)

    expect(planDigest).toHaveAttribute("aria-checked", "false")
    await waitFor(() => expect(upsertEndUserProperty).toHaveBeenCalledTimes(1))

    firstSave.resolve({ ...properties[0], isDigestField: true })

    await waitFor(() => expect(upsertEndUserProperty).toHaveBeenCalledTimes(2))
    expect(planDigest).toHaveAttribute("aria-checked", "false")

    secondSave.resolve({
      ...properties[0],
      remark: "latest digest selection saved",
      isDigestField: false,
    })

    await waitFor(() =>
      expect(
        queryClient.getQueryData<EndUserProperty[]>([
          "end-users",
          "env-1",
          "properties",
        ])?.[0].remark
      ).toBe("latest digest selection saved")
    )
    expect(planDigest).toHaveAttribute("aria-checked", "false")
  })
})
