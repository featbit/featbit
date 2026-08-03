import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { CodeBlock } from "./code-block"

const mocks = vi.hoisted(() => ({
  codeToTokens: vi.fn(),
}))

vi.mock("shiki", () => ({
  codeToTokens: mocks.codeToTokens,
}))

describe("CodeBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("lazily highlights initialization code for light and dark themes", async () => {
    mocks.codeToTokens.mockResolvedValue({
      tokens: [
        [
          {
            content: "const",
            htmlStyle: {
              color: "var(--test-light-keyword)",
              "--shiki-dark": "var(--test-dark-keyword)",
            },
          },
          {
            content: " enabled = true",
            htmlStyle: {
              color: "var(--test-light-code)",
              "--shiki-dark": "var(--test-dark-code)",
            },
          },
        ],
      ],
    })

    render(
      <CodeBlock
        code="const enabled = true"
        language="JavaScript"
        highlight
        lineNumbers
      />
    )

    const keyword = await screen.findByText("const")
    expect(keyword.style.getPropertyValue("--syntax-light")).toBe(
      "var(--test-light-keyword)"
    )
    expect(keyword.style.getPropertyValue("--syntax-dark")).toBe(
      "var(--test-dark-keyword)"
    )
    expect(mocks.codeToTokens).toHaveBeenCalledWith(
      "const enabled = true",
      expect.objectContaining({
        lang: "javascript",
        themes: {
          light: "github-light-default",
          dark: "github-dark-default",
        },
      })
    )
  })
})
