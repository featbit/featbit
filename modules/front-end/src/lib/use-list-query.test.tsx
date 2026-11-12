import { act, fireEvent, render, screen } from "@testing-library/react"
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DetailBackLink } from "@/components/detail-back-link"
import { ListDetailLink, DetailTabLink } from "@/components/list-detail-link"
import { useDetailNavigate } from "./list-navigation"
import { useListQuery, useListSearch } from "./use-list-query"

function List() {
  const {
    searchParams,
    updateParams,
    pageIndex,
    pageSize,
    setPageIndex,
    setPageSize,
  } = useListQuery()
  const { search, setSearch, debouncedSearch } = useListSearch(
    searchParams,
    updateParams
  )
  const navigate = useNavigate()
  return (
    <>
      <input
        aria-label="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <output data-testid="state">
        {JSON.stringify({ pageIndex, pageSize, search: debouncedSearch })}
      </output>
      <button onClick={() => setPageIndex((current) => current + 1)}>
        Next
      </button>
      <button
        onClick={() => {
          setPageSize(30)
          setPageIndex(1)
        }}
      >
        Resize
      </button>
      <button
        onClick={() => {
          updateParams({ archived: "true" }, true)
          setPageIndex(1)
        }}
      >
        Archive filter
      </button>
      <button
        onClick={() => navigate("/en/segments?name=other&page=4&pageSize=30")}
      >
        Other URL
      </button>
      <button
        onClick={() =>
          navigate("/en/segments?name=checkout&page=4&pageSize=20")
        }
      >
        Same search URL
      </button>
      <button onClick={() => navigate(-1)}>History back</button>
      <ListDetailLink to="/en/segments/one/targeting">Details</ListDetailLink>
    </>
  )
}

function Details() {
  const navigate = useDetailNavigate("/en/segments")
  return (
    <>
      <DetailBackLink to="/en/segments">Back to list</DetailBackLink>
      <DetailTabLink to="/en/segments/one/settings">Settings</DetailTabLink>
      <button onClick={() => navigate("/en/segments/one/history")}>
        History tab
      </button>
      <button onClick={() => navigate("/en/segments")}>Deleted</button>
    </>
  )
}

function Location() {
  const location = useLocation()
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
      {location.hash}
    </output>
  )
}

function setup(
  url = "/en/segments?name=checkout&page=3&pageSize=20&archived=true"
) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Location />
      <Routes>
        <Route path="/en/segments" element={<List />} />
        <Route path="/en/segments/:id/:tab" element={<Details />} />
      </Routes>
    </MemoryRouter>
  )
}

afterEach(() => vi.useRealTimers())

describe("URL list state", () => {
  it.each(["Archive filter", "Next", "Resize"])(
    "preserves a pending search through %s",
    (control) => {
      vi.useFakeTimers()
      setup("/en/segments?name=checkout&page=3&pageSize=20")
      fireEvent.change(screen.getByLabelText("search"), {
        target: { value: "pending" },
      })
      act(() => vi.advanceTimersByTime(100))
      fireEvent.click(screen.getByText(control))
      expect(screen.getByLabelText("search")).toHaveValue("pending")
      act(() => vi.advanceTimersByTime(1000))
      expect(screen.getByTestId("state")).toHaveTextContent(
        '"search":"pending"'
      )
      expect(screen.getByTestId("state")).toHaveTextContent('"pageIndex":1')
      if (control === "Archive filter")
        expect(screen.getByTestId("location")).toHaveTextContent(
          "archived=true"
        )
      if (control === "Resize")
        expect(screen.getByTestId("state")).toHaveTextContent('"pageSize":30')
    }
  )

  it("discards pending input on history navigation even when the committed search is unchanged", () => {
    vi.useFakeTimers()
    setup()
    fireEvent.click(screen.getByText("Same search URL"))
    fireEvent.change(screen.getByLabelText("search"), {
      target: { value: "pending" },
    })
    fireEvent.click(screen.getByText("History back"))
    expect(screen.getByLabelText("search")).toHaveValue("checkout")
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByTestId("state")).toHaveTextContent('"pageIndex":3')
  })
  it("restores a direct URL without resetting it after the debounce", () => {
    vi.useFakeTimers()
    setup()
    expect(screen.getByLabelText("search")).toHaveValue("checkout")
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByTestId("state")).toHaveTextContent(
      '"pageIndex":3,"pageSize":20'
    )
    fireEvent.change(screen.getByLabelText("search"), {
      target: { value: " checkout " },
    })
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByTestId("state")).toHaveTextContent('"pageIndex":3')
    fireEvent.change(screen.getByLabelText("search"), {
      target: { value: "changed" },
    })
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByTestId("state")).toHaveTextContent(
      '"pageIndex":1,"pageSize":20,"search":"changed"'
    )
    expect(screen.getByTestId("location")).toHaveTextContent("archived=true")
  })

  it("merges sequential writes in one event and resets cursor with filters", () => {
    setup("/en/segments?page=3&pageSize=20&cursor=old&name=checkout")
    fireEvent.click(screen.getByText("Resize"))
    expect(screen.getByTestId("state")).toHaveTextContent(
      '"pageIndex":1,"pageSize":30'
    )
    expect(screen.getByTestId("location")).not.toHaveTextContent("cursor=")
    fireEvent.click(screen.getByText("Next"))
    fireEvent.click(screen.getByText("Archive filter"))
    expect(screen.getByTestId("location")).toHaveTextContent("archived=true")
    expect(screen.getByTestId("state")).toHaveTextContent(
      '"pageIndex":1,"pageSize":30'
    )
  })

  it("synchronizes search and pagination on browser history navigation", () => {
    vi.useFakeTimers()
    setup()
    fireEvent.click(screen.getByText("Other URL"))
    expect(screen.getByLabelText("search")).toHaveValue("other")
    fireEvent.click(screen.getByText("History back"))
    expect(screen.getByLabelText("search")).toHaveValue("checkout")
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByTestId("state")).toHaveTextContent(
      '"pageIndex":3,"pageSize":20'
    )
  })

  it.each(["Back to list", "Deleted"])(
    "restores the complete URL through detail tabs using %s",
    (back) => {
      const url =
        "/en/segments?name=checkout&page=3&pageSize=20&archived=true#results"
      setup(url)
      fireEvent.click(screen.getByText("Details"))
      fireEvent.click(screen.getByText("Settings"))
      fireEvent.click(screen.getByText("History tab"))
      fireEvent.click(screen.getByText(back))
      expect(screen.getByTestId("location")).toHaveTextContent(url)
      expect(screen.getByTestId("state")).toHaveTextContent(
        '"pageIndex":3,"pageSize":20'
      )
    }
  )

  it("cancels an uncommitted search when navigating to a URL with the same search", () => {
    vi.useFakeTimers()
    setup()
    fireEvent.change(screen.getByLabelText("search"), {
      target: { value: "pending" },
    })
    fireEvent.click(screen.getByText("Same search URL"))
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByLabelText("search")).toHaveValue("checkout")
    expect(screen.getByTestId("state")).toHaveTextContent('"pageIndex":4')
  })

  it("rejects invalid page values and allows direct detail visits without an origin", () => {
    setup("/en/segments?page=-3&pageSize=999")
    expect(screen.getByTestId("state")).toHaveTextContent(
      '"pageIndex":1,"pageSize":10'
    )
  })
})
