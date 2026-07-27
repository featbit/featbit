import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { i18n } from "@/lib/i18n/i18n"
import type { FlagRule } from "../../flags-types"
import {
  FlagChangeBadgeLabel,
  FlagDefaultChangeContent,
  FlagRuleChangeContent,
  FlagRuleChangeLabel,
} from "./flag-rule-change-content"

function rule(conditions: FlagRule["conditions"]): FlagRule {
  return {
    id: "rule-1",
    name: "Enterprise accounts",
    dispatchKey: "keyId",
    conditions,
    variations: [{ id: "new", rollout: [0, 1] }],
  }
}

describe("feature flag rule review content", () => {
  it("labels conditions when a complete rule is added", async () => {
    await i18n.changeLanguage("en")
    const current = rule([
      {
        id: "condition-1",
        property: "role",
        op: "IsOneOf",
        value: '["admin"]',
      },
    ])

    render(
      <FlagRuleChangeContent
        currentRule={current}
        currentServing={{
          variations: [{ id: "new", name: "Variation B" }],
        }}
      />
    )

    expect(screen.getByText("Conditions")).toBeVisible()
    expect(screen.getByText("role")).toBeVisible()
    expect(screen.getByText("is one of")).toBeVisible()
    expect(screen.getByText("admin")).toBeVisible()
    expect(screen.getByText("Serve")).toBeVisible()
    expect(screen.getByText("Variation B")).toBeVisible()
  })

  it("uses the shared Rule badge and shows added conditions instead of unchanged serving", async () => {
    await i18n.changeLanguage("en")
    const previous = rule([
      {
        id: "condition-1",
        property: "plan",
        op: "Equal",
        value: "enterprise",
      },
    ])
    const current = rule([
      ...previous.conditions,
      {
        id: "condition-2",
        property: "region",
        op: "Equal",
        value: "EU",
      },
      {
        id: "condition-3",
        property: "country",
        op: "IsOneOf",
        value: '["DE","FR"]',
      },
    ])

    render(
      <TooltipProvider>
        <FlagRuleChangeLabel name={current.name} />
        <FlagRuleChangeContent
          previousRule={previous}
          currentRule={current}
          previousServing={{
            variations: [{ id: "new", name: "New checkout" }],
          }}
          currentServing={{
            variations: [{ id: "new", name: "New checkout" }],
          }}
        />
      </TooltipProvider>
    )

    expect(screen.getByText("Rule")).toBeVisible()
    expect(screen.getByText("Enterprise accounts")).toBeVisible()
    expect(screen.getByText("Conditions")).toBeVisible()
    expect(screen.getAllByText("Added")).toHaveLength(2)
    expect(screen.getByText("equals")).toHaveClass("font-mono")
    expect(screen.getByText("is one of")).toHaveClass("font-mono")
    expect(screen.getByText("AND")).toHaveClass("font-mono")
    expect(screen.getByText("region")).not.toHaveClass("font-mono")
    expect(screen.getByText("EU")).not.toHaveClass("font-mono")
    expect(screen.getByText("country")).not.toHaveClass("font-mono")
    expect(screen.getByText("DE, FR")).not.toHaveClass("font-mono")
    expect(screen.queryByText("Serve")).not.toBeInTheDocument()
    expect(screen.queryByText(/100%/)).not.toBeInTheDocument()
  })

  it("shows User and Default badges with their targeting labels", async () => {
    await i18n.changeLanguage("en")
    render(
      <TooltipProvider>
        <FlagChangeBadgeLabel badge="User" name="Variation A" />
        <FlagChangeBadgeLabel badge="Default" name="Flag ON" />
        <FlagChangeBadgeLabel badge="Default" name="Flag OFF" />
      </TooltipProvider>
    )

    expect(screen.getByText("User")).toBeVisible()
    expect(screen.getByText("Variation A")).toBeVisible()
    expect(screen.getAllByText("Default")).toHaveLength(2)
    expect(screen.getByText("Flag ON")).toBeVisible()
    expect(screen.getByText("Flag OFF")).toBeVisible()
  })

  it("labels ON and OFF default changes as Serve", async () => {
    await i18n.changeLanguage("en")
    render(
      <>
        <FlagDefaultChangeContent
          previous={{
            variations: [{ id: "a", name: "Variation A" }],
          }}
          current={{
            variations: [{ id: "b", name: "Variation B" }],
          }}
        />
        <FlagDefaultChangeContent
          previous={{
            variations: [{ id: "b", name: "Variation B" }],
          }}
          current={{
            variations: [{ id: "a", name: "Variation A" }],
          }}
        />
      </>
    )

    expect(screen.getAllByText("Serve")).toHaveLength(2)
    expect(screen.getAllByText("Serve")).toSatisfy((items: HTMLElement[]) =>
      items.every((item) => item.classList.contains("font-mono"))
    )
    expect(screen.getAllByText("Variation A")).toHaveLength(2)
    expect(screen.getAllByText("Variation B")).toHaveLength(2)
  })

  it("matches Compare Sheet rollout and dispatch-key formatting", async () => {
    await i18n.changeLanguage("en")
    render(
      <FlagDefaultChangeContent
        previous={{ variations: [{ id: "a", name: "Variation A" }] }}
        current={{
          variations: [
            { id: "a", name: "Variation A", percentage: 40 },
            { id: "b", name: "Variation B", percentage: 60 },
          ],
          dispatchKey: "keyId",
        }}
      />
    )

    expect(screen.getAllByText("Serve")).toSatisfy((items: HTMLElement[]) =>
      items.every((item) => item.classList.contains("font-mono"))
    )
    expect(screen.getByText("40%")).toHaveClass("text-muted-foreground")
    expect(screen.getByText("60%")).toHaveClass("text-muted-foreground")
    expect(screen.getByText("Dispatch by").parentElement).toHaveClass(
      "text-muted-foreground"
    )
    expect(screen.getByText("keyId")).toHaveClass("text-foreground")
    expect(screen.getAllByText("Variation A")).toSatisfy(
      (items: HTMLElement[]) =>
        items.every((item) => !item.classList.contains("font-mono"))
    )
  })
})
