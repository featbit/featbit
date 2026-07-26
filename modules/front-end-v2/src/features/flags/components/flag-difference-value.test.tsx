import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { FlagComparisonValue } from "../flags-types"
import { FlagDifferenceValue } from "./flag-difference-value"

function comparisonValue(
  rules: FlagComparisonValue["rules"]
): FlagComparisonValue {
  return {
    id: "flag-1",
    name: "Checkout redesign",
    key: "checkout-redesign",
    isEnabled: true,
    variations: [
      { id: "true", name: "True", value: "true" },
      { id: "false", name: "False", value: "false" },
    ],
    targetUsers: [],
    rules,
    fallthrough: null,
    disabledVariationId: "false",
  }
}

describe("FlagDifferenceValue targeting rules", () => {
  it("lists individual users and reveals the complete list from +N", async () => {
    const flag = comparisonValue([])
    flag.targetUsers = [
      {
        variationId: "true",
        keyIds: Array.from({ length: 12 }, (_, index) => `user-${index + 1}`),
      },
    ]
    render(<FlagDifferenceValue flag={flag} setting="individualTargeting" />)

    expect(screen.getByText("user-1")).toBeVisible()
    expect(screen.getByText("user-10")).toBeVisible()
    expect(screen.getByText("user-1").parentElement).toHaveClass(
      "border-muted-foreground/30",
      "bg-background"
    )
    expect(screen.getByText("+2")).toBeVisible()
    expect(screen.queryByText("12 users")).not.toBeInTheDocument()

    const more = screen.getByLabelText("Show all 12 users")
    fireEvent.pointerMove(document, { pointerType: "mouse" })
    fireEvent.mouseEnter(more)

    expect(await screen.findByText("All users")).toBeVisible()
    expect(screen.getByText("user-12")).toBeVisible()
    expect(screen.getAllByText("user-1")).toHaveLength(2)
  })

  it("uses the added style for users in a source tooltip", async () => {
    const flag = comparisonValue([])
    flag.targetUsers = [
      {
        variationId: "true",
        keyIds: Array.from({ length: 11 }, (_, index) => `user-${index + 1}`),
      },
    ]
    render(
      <FlagDifferenceValue
        flag={flag}
        setting="individualTargeting"
        tooltipUserStyle="added"
      />
    )

    const more = screen.getByLabelText("Show all 11 users")
    fireEvent.pointerMove(document, { pointerType: "mouse" })
    fireEvent.mouseEnter(more)

    const sourceBadge = (await screen.findByText("user-11")).parentElement
    expect(sourceBadge).toHaveAttribute("data-user-origin", "added")
    expect(sourceBadge).toHaveClass(
      "bg-primary",
      "text-primary-foreground",
      "border-background/40"
    )
  })

  it("previews appended users as a deduplicated merge with distinct origins", () => {
    const target = comparisonValue([])
    target.variations = [
      { id: "target-true", name: "Target true", value: "true" },
    ]
    target.targetUsers = [
      {
        variationId: "target-true",
        keyIds: ["existing-user", "shared-user"],
      },
    ]

    const source = comparisonValue([])
    source.variations = [
      { id: "source-true", name: "Source true", value: "true" },
      { id: "source-beta", name: "Beta", value: "beta" },
    ]
    source.targetUsers = [
      {
        variationId: "source-true",
        keyIds: ["added-user", "shared-user"],
      },
      { variationId: "source-beta", keyIds: ["beta-user"] },
    ]

    render(
      <FlagDifferenceValue
        flag={target}
        source={source}
        setting="individualTargeting"
        previewMode="append"
      />
    )

    const existingBadge = screen.getByText("existing-user").parentElement
    const sharedBadges = screen.getAllByText("shared-user")
    const addedBadge = screen.getByText("added-user").parentElement

    expect(screen.getByText("Target true")).toBeVisible()
    expect(screen.getByText("Beta")).toBeVisible()
    expect(screen.getByText("beta-user").parentElement).toHaveAttribute(
      "data-user-origin",
      "added"
    )
    expect(sharedBadges).toHaveLength(1)
    expect(existingBadge).toHaveAttribute("data-user-origin", "existing")
    expect(existingBadge).toHaveClass(
      "border-muted-foreground/30",
      "bg-background"
    )
    expect(addedBadge).toHaveAttribute("data-user-origin", "added")
    expect(addedBadge).toHaveClass(
      "border-primary/40",
      "bg-primary/10",
      "text-primary"
    )
    expect(screen.getByTestId("target-user-origin-legend")).toHaveTextContent(
      "ExistingAdded"
    )
    expect(screen.queryByText("Source users appended")).not.toBeInTheDocument()
  })

  it("shows newly appended users immediately in the +N tooltip", async () => {
    const target = comparisonValue([])
    target.targetUsers = [
      {
        variationId: "true",
        keyIds: Array.from(
          { length: 10 },
          (_, index) => `existing-${index + 1}`
        ),
      },
    ]
    const source = comparisonValue([])
    source.targetUsers = [
      {
        variationId: "true",
        keyIds: ["added-1", "added-2"],
      },
    ]

    render(
      <FlagDifferenceValue
        flag={target}
        source={source}
        setting="individualTargeting"
        previewMode="append"
      />
    )

    const more = screen.getByLabelText("Show all 12 users")
    fireEvent.pointerMove(document, { pointerType: "mouse" })
    fireEvent.mouseEnter(more)

    const addedBadge = (await screen.findByText("added-1")).parentElement
    const tooltipList = screen.getByTestId("target-users-tooltip-list")
    expect(tooltipList.firstElementChild).toHaveTextContent("existing-1")
    expect(addedBadge).toHaveAttribute("data-user-origin", "added")
    expect(addedBadge).toHaveClass(
      "border-background/40",
      "bg-primary",
      "text-primary-foreground"
    )
    expect(addedBadge).not.toHaveClass("bg-primary/10", "text-primary")
    expect(screen.getByText("added-2")).toBeVisible()
    expect(screen.getAllByText("existing-1")).toHaveLength(2)
  })

  it("renders structured rule syntax without counts, numbering, or a single-value percentage", () => {
    render(
      <FlagDifferenceValue
        flag={comparisonValue([
          {
            id: "rule-1",
            name: "Rule 1",
            conditions: [
              { property: "location", op: "equals", value: "fr" },
              { property: "plan", op: "equals", value: "Pro" },
            ],
            variations: [{ id: "true", rollout: [0, 1] }],
            dispatchKey: "email",
          },
        ])}
        setting="targetingRule"
      />
    )

    expect(screen.getByText("Rule 1")).toBeVisible()
    expect(screen.queryByText("1 rule")).not.toBeInTheDocument()
    expect(screen.queryByText("1. Rule 1")).not.toBeInTheDocument()
    expect(screen.getByText("IF")).toHaveClass("font-mono")
    expect(screen.getByText("AND")).toHaveClass("font-mono")
    expect(screen.getAllByText("equals")[0]).toHaveClass("font-mono")
    expect(screen.getByText("location")).not.toHaveClass("font-mono")
    expect(screen.getByText("Serve")).toHaveClass("font-mono")
    expect(screen.getByTestId("rule-variation-name")).toHaveClass(
      "font-normal",
      "text-foreground"
    )
    expect(screen.getByTestId("rule-variation-name")).not.toHaveAttribute(
      "data-slot",
      "badge"
    )
    expect(screen.getByText("IF")).toHaveClass("w-10")
    expect(screen.getByText("AND")).toHaveClass("w-10")
    expect(screen.getByText("Serve")).toHaveClass("w-10")
    expect(screen.getAllByTestId("rule-condition-row")[1]).not.toHaveClass(
      "border-t"
    )
    expect(screen.getAllByTestId("rule-condition-row")[0]).toHaveClass(
      "py-1",
      "first:pt-2",
      "last:pb-2"
    )
    expect(screen.queryByText("100%")).not.toBeInTheDocument()
    expect(screen.queryByText("Dispatch by")).not.toBeInTheDocument()
    expect(screen.queryByText("THEN")).not.toBeInTheDocument()
  })

  it("uses the same keyword width with Chinese labels", () => {
    render(
      <FlagDifferenceValue
        lang="zh"
        flag={comparisonValue([
          {
            id: "rule-1",
            name: "规则一",
            conditions: [
              { property: "地区", op: "equals", value: "法国" },
              { property: "套餐", op: "equals", value: "专业版" },
            ],
            variations: [
              { id: "true", rollout: [0, 0.75] },
              { id: "false", rollout: [0.75, 0.25] },
            ],
            dispatchKey: "地区",
          },
        ])}
        setting="targetingRule"
      />
    )

    expect(screen.getByText("如果")).toHaveClass("w-10", "font-mono")
    expect(screen.getByText("并且")).toHaveClass("w-10", "font-mono")
    expect(screen.getByText("返回")).toHaveClass("w-10", "font-mono")
    expect(screen.getByText("基于属性")).toBeVisible()
    expect(screen.getByTestId("dispatch-key")).toHaveTextContent("地区")
    expect(screen.getByTestId("dispatch-key")).toHaveClass("font-normal")
    expect(screen.getByTestId("dispatch-key")).not.toHaveClass(
      "font-mono",
      "bg-muted"
    )
    expect(screen.queryByText("Serve")).not.toBeInTheDocument()
  })

  it("keeps percentages for a multi-variation rollout", () => {
    render(
      <FlagDifferenceValue
        flag={comparisonValue([
          {
            id: "rule-1",
            name: "Rule 1",
            conditions: [{ property: "country", op: "equals", value: "US" }],
            variations: [
              { id: "true", rollout: [0, 0.75] },
              { id: "false", rollout: [0.75, 0.25] },
            ],
            dispatchKey: "keyId",
          },
        ])}
        setting="targetingRule"
      />
    )

    expect(screen.getByText("75%")).toBeVisible()
    expect(screen.getByText("25%")).toBeVisible()
    expect(
      screen.getAllByTestId("targeting-variation-percentage")[0]
    ).toHaveClass("text-xs", "text-muted-foreground")
    expect(screen.getByText("Dispatch by")).toBeVisible()
    expect(screen.getByText("keyId")).toBeVisible()
  })

  it("uses the same dispatch-key condition for the default rule", () => {
    const single = comparisonValue([])
    single.fallthrough = {
      variations: [{ id: "true", rollout: [0, 1] }],
      dispatchKey: "email",
    }
    const { rerender } = render(
      <FlagDifferenceValue flag={single} setting="defaultRule" />
    )

    expect(screen.queryByText("Dispatch by")).not.toBeInTheDocument()
    expect(screen.queryByText("100%")).not.toBeInTheDocument()

    const rollout = comparisonValue([])
    rollout.fallthrough = {
      variations: [
        { id: "true", rollout: [0, 0.75] },
        { id: "false", rollout: [0.75, 0.25] },
      ],
      dispatchKey: "country",
    }
    rerender(<FlagDifferenceValue flag={rollout} setting="defaultRule" />)

    expect(screen.getByText("Dispatch by")).toBeVisible()
    expect(screen.getByText("country")).toBeVisible()
    expect(screen.getAllByTestId("default-variation-name")[0]).toHaveClass(
      "font-normal"
    )
    const defaultPercentage = screen.getAllByTestId(
      "default-variation-percentage"
    )[0]
    expect(defaultPercentage).toHaveClass("text-xs", "text-muted-foreground")
    expect(screen.queryByText(/·/)).not.toBeInTheDocument()
  })
})
