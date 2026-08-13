import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { removeEndUserProperty, upsertEndUserProperty } from "../end-users-api"
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
    vi.mocked(removeEndUserProperty).mockReset()
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

  it("serializes remark saves with queued digest updates", async () => {
    const firstDigestSave = deferred<EndUserProperty>()
    const secondDigestSave = deferred<EndUserProperty>()
    const remarkSave = deferred<EndUserProperty>()
    vi.mocked(upsertEndUserProperty)
      .mockReturnValueOnce(firstDigestSave.promise)
      .mockReturnValueOnce(secondDigestSave.promise)
      .mockReturnValueOnce(remarkSave.promise)
    const { queryClient } = renderSheet()

    const [planDigest] = screen.getAllByRole("checkbox")
    fireEvent.click(planDigest)
    fireEvent.click(planDigest)
    await waitFor(() => expect(upsertEndUserProperty).toHaveBeenCalledTimes(1))

    const planRow = screen.getByText("plan").closest("tr")
    expect(planRow).not.toBeNull()
    fireEvent.click(within(planRow!).getByRole("button", { name: "Edit" }))
    fireEvent.change(within(planRow!).getByRole("textbox"), {
      target: { value: "updated remark" },
    })
    fireEvent.click(within(planRow!).getByRole("button", { name: "Save" }))

    expect(upsertEndUserProperty).toHaveBeenCalledTimes(1)

    firstDigestSave.resolve({ ...properties[0], isDigestField: true })
    await waitFor(() => expect(upsertEndUserProperty).toHaveBeenCalledTimes(2))
    expect(vi.mocked(upsertEndUserProperty).mock.calls[1][2]).toMatchObject({
      isDigestField: false,
      remark: "",
    })

    secondDigestSave.resolve({ ...properties[0], isDigestField: false })
    await waitFor(() => expect(upsertEndUserProperty).toHaveBeenCalledTimes(3))
    expect(vi.mocked(upsertEndUserProperty).mock.calls[2][2]).toMatchObject({
      isDigestField: false,
      remark: "updated remark",
    })

    remarkSave.resolve({
      ...properties[0],
      isDigestField: false,
      remark: "updated remark",
    })
    await waitFor(() =>
      expect(
        queryClient.getQueryData<EndUserProperty[]>([
          "end-users",
          "env-1",
          "properties",
        ])?.[0]
      ).toMatchObject({ isDigestField: false, remark: "updated remark" })
    )
  })

  it("waits for queued saves before removing a property", async () => {
    const save = deferred<EndUserProperty>()
    const remove = deferred<boolean>()
    vi.mocked(upsertEndUserProperty).mockReturnValue(save.promise)
    vi.mocked(removeEndUserProperty).mockReturnValue(remove.promise)
    const { queryClient } = renderSheet()

    const [planDigest] = screen.getAllByRole("checkbox")
    fireEvent.click(planDigest)
    await waitFor(() => expect(upsertEndUserProperty).toHaveBeenCalledTimes(1))

    const planRow = screen.getByText("plan").closest("tr")
    expect(planRow).not.toBeNull()
    fireEvent.click(within(planRow!).getByRole("button", { name: "Remove" }))
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "Remove property?" })
      ).getByRole("button", { name: "Remove" })
    )

    expect(removeEndUserProperty).not.toHaveBeenCalled()

    save.resolve({ ...properties[0], isDigestField: true })
    await waitFor(() => expect(removeEndUserProperty).toHaveBeenCalledTimes(1))

    remove.resolve(true)
    await waitFor(() =>
      expect(
        queryClient
          .getQueryData<EndUserProperty[]>(["end-users", "env-1", "properties"])
          ?.some((property) => property.id === properties[0].id)
      ).toBe(false)
    )
  })
})
